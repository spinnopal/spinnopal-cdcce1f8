import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { emailSchema } from "@/lib/validation";


const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2)
  .max(40)
  .regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/, "Use lowercase letters, numbers and dashes only");

const nameSchema = z.string().trim().min(1).max(80);

async function publicClient() {
  // Server-side publishable client for anon-readable data during SSR or public fns.
  const { createClient } = await import("@supabase/supabase-js");
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

async function isSuperAdmin(ctx: { supabase: any; userId: string }) {
  const { data } = await ctx.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", ctx.userId)
    .eq("role", "super_admin")
    .maybeSingle();
  return !!data;
}

// ------------ PUBLIC (customer-facing) ------------

export const getPublicShop = createServerFn({ method: "GET" })
  .inputValidator(z.object({ slug: slugSchema }).parse)
  .handler(async ({ data }) => {
    const sb = await publicClient();
    const { data: shop, error } = await sb
      .from("shops")
      .select("id, name, slug, logo_url, is_active, subscription_status, trial_ends_at, current_period_end")
      .eq("slug", data.slug)
      .maybeSingle();
    if (error) throw new Error("Server error");
    if (!shop || !shop.is_active) return { shop: null as null };
    // Hide shop when subscription is suspended or trial/period expired
    const now = Date.now();
    const status = shop.subscription_status as string;
    const trialEnd = shop.trial_ends_at ? new Date(shop.trial_ends_at).getTime() : null;
    const periodEnd = shop.current_period_end ? new Date(shop.current_period_end).getTime() : null;
    if (status === "suspended") return { shop: null as null };
    if (status === "trial" && trialEnd && trialEnd < now) return { shop: null as null };
    if (status === "active" && periodEnd && periodEnd < now) return { shop: null as null };
    if (status === "past_due" && periodEnd && periodEnd < now) return { shop: null as null };
    return { shop };
  });


export const getPublicPrizes = createServerFn({ method: "GET" })
  .inputValidator(z.object({ slug: slugSchema }).parse)
  .handler(async ({ data }) => {
    const sb = await publicClient();
    const { data: shop } = await sb
      .from("shops")
      .select("id")
      .eq("slug", data.slug)
      .eq("is_active", true)
      .maybeSingle();
    if (!shop) return { prizes: [] };
    const { data: prizes, error } = await sb
      .from("prizes")
      .select("id, name, short, image_url, is_win, probability, sort_order")
      .eq("shop_id", shop.id)
      .order("sort_order", { ascending: true });
    if (error) throw new Error("Server error");
    return { prizes: prizes ?? [] };
  });

// ------------ AUTHENTICATED (shop owner) ------------

export const listMyShops = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("shops")
      .select("*")
      .eq("owner_user_id", context.userId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    const superAdmin = await isSuperAdmin(context);
    return { shops: data ?? [], superAdmin };
  });

export const createShop = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ name: nameSchema, slug: slugSchema, email: emailSchema.optional() }).parse)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing } = await supabaseAdmin
      .from("shops")
      .select("id")
      .eq("slug", data.slug)
      .maybeSingle();
    if (existing) throw new Error("That URL is taken — try another.");
    const { data: shop, error } = await context.supabase
      .from("shops")
      .insert({ name: data.name, slug: data.slug, owner_user_id: context.userId })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return { shop };
  });

export const updateMyShop = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z
      .object({
        id: z.string().uuid(),
        name: nameSchema.optional(),
        slug: slugSchema.optional(),
        logo_url: z.string().max(15_000_000).nullable().optional(),
      })
      .parse,
  )
  .handler(async ({ data, context }) => {
    const patch: { name?: string; slug?: string; logo_url?: string | null } = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.slug !== undefined) patch.slug = data.slug;
    if (data.logo_url !== undefined) patch.logo_url = data.logo_url;
    if (Object.keys(patch).length === 0) return { ok: true };

    if (data.slug) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: existing } = await supabaseAdmin
        .from("shops")
        .select("id")
        .eq("slug", data.slug)
        .neq("id", data.id)
        .maybeSingle();
      if (existing) throw new Error("That URL is taken — try another.");
    }

    const { data: shop, error } = await context.supabase
      .from("shops")
      .update(patch)
      .eq("id", data.id)
      .eq("owner_user_id", context.userId)
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!shop) throw new Error("Not found or not authorized");
    return { shop };
  });

// ------------ SUPER ADMIN ------------

export const bootstrapSuperAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ password: z.string().min(1).max(128) }).parse)
  .handler(async ({ data, context }) => {
    const expected = process.env.ADMIN_PASSWORD;
    if (!expected) throw new Error("Bootstrap not configured");
    if (data.password !== expected) throw new Error("Wrong password");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: context.userId, role: "super_admin" }, { onConflict: "user_id,role" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listAllShops = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    if (!(await isSuperAdmin(context))) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: shops, error } = await supabaseAdmin
      .from("shops")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    // Owner emails + counts
    const enriched = await Promise.all(
      (shops ?? []).map(async (s) => {
        let ownerEmail: string | null = null;
        let lastSignIn: string | null = null;
        let emailConfirmed: string | null = null;
        if (s.owner_user_id) {
          const { data: u } = await supabaseAdmin.auth.admin.getUserById(s.owner_user_id);
          ownerEmail = u.user?.email ?? null;
          lastSignIn = u.user?.last_sign_in_at ?? null;
          emailConfirmed = u.user?.email_confirmed_at ?? null;
        }
        const { count: codes } = await supabaseAdmin
          .from("access_codes")
          .select("*", { count: "exact", head: true })
          .eq("shop_id", s.id);
        const { count: spins } = await supabaseAdmin
          .from("access_codes")
          .select("*", { count: "exact", head: true })
          .eq("shop_id", s.id)
          .not("spun_at", "is", null);
        return {
          ...s,
          owner_email: ownerEmail,
          owner_last_sign_in_at: lastSignIn,
          owner_email_confirmed_at: emailConfirmed,
          codes_count: codes ?? 0,
          spins_count: spins ?? 0,
        };
      }),
    );
    return { shops: enriched };
  });

export const setShopActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid(), is_active: z.boolean() }).parse)
  .handler(async ({ data, context }) => {
    if (!(await isSuperAdmin(context))) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("shops").update({ is_active: data.is_active }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteShop = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }).parse)
  .handler(async ({ data, context }) => {
    if (!(await isSuperAdmin(context))) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("shops").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const claimShop = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }).parse)
  .handler(async ({ data, context }) => {
    if (!(await isSuperAdmin(context))) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("shops")
      .update({ owner_user_id: context.userId })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ------------ SUPER ADMIN: owner account controls ------------

async function getShopOwnerId(shopId: string): Promise<string | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("shops").select("owner_user_id").eq("id", shopId).maybeSingle();
  return data?.owner_user_id ?? null;
}

export const sendOwnerPasswordReset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ shopId: z.string().uuid(), redirectTo: z.string().url().optional() }).parse)
  .handler(async ({ data, context }) => {
    if (!(await isSuperAdmin(context))) throw new Error("Forbidden");
    const ownerId = await getShopOwnerId(data.shopId);
    if (!ownerId) throw new Error("Shop has no owner");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: u } = await supabaseAdmin.auth.admin.getUserById(ownerId);
    const email = u.user?.email;
    if (!email) throw new Error("Owner has no email");
    const { error } = await supabaseAdmin.auth.resetPasswordForEmail(email, {
      redirectTo: data.redirectTo,
    });
    if (error) throw new Error(error.message);
    return { ok: true, email };
  });

export const forceSetOwnerPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ shopId: z.string().uuid(), password: z.string().min(8).max(128) }).parse)
  .handler(async ({ data, context }) => {
    if (!(await isSuperAdmin(context))) throw new Error("Forbidden");
    const ownerId = await getShopOwnerId(data.shopId);
    if (!ownerId) throw new Error("Shop has no owner");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(ownerId, { password: data.password });
    if (error) throw new Error(error.message);
    // Also revoke active sessions so the owner must use the new password.
    await supabaseAdmin.auth.admin.signOut(ownerId, "global").catch(() => {});
    return { ok: true };
  });

export const signOutOwner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ shopId: z.string().uuid() }).parse)
  .handler(async ({ data, context }) => {
    if (!(await isSuperAdmin(context))) throw new Error("Forbidden");
    const ownerId = await getShopOwnerId(data.shopId);
    if (!ownerId) throw new Error("Shop has no owner");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.signOut(ownerId, "global");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ------------ SUPER ADMIN: shop details ------------

export const getShopDetails = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ shopId: z.string().uuid() }).parse)
  .handler(async ({ data, context }) => {
    if (!(await isSuperAdmin(context))) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: shop, error: shopErr } = await supabaseAdmin
      .from("shops").select("*").eq("id", data.shopId).maybeSingle();
    if (shopErr) throw new Error(shopErr.message);
    if (!shop) throw new Error("Not found");

    let owner: { email: string | null; last_sign_in_at: string | null; email_confirmed_at: string | null; created_at: string | null } | null = null;
    if (shop.owner_user_id) {
      const { data: u } = await supabaseAdmin.auth.admin.getUserById(shop.owner_user_id);
      if (u.user) {
        owner = {
          email: u.user.email ?? null,
          last_sign_in_at: u.user.last_sign_in_at ?? null,
          email_confirmed_at: u.user.email_confirmed_at ?? null,
          created_at: u.user.created_at ?? null,
        };
      }
    }

    const { data: prizes } = await supabaseAdmin
      .from("prizes").select("id, name, short, image_url, is_win, probability, sort_order")
      .eq("shop_id", data.shopId).order("sort_order", { ascending: true });

    const { data: codes } = await supabaseAdmin
      .from("access_codes").select("code, is_used, customer_name, customer_contact, customer_email, prize_won, spun_at, created_at")
      .eq("shop_id", data.shopId).order("created_at", { ascending: false }).limit(500);

    const { data: spins } = await supabaseAdmin
      .from("access_codes").select("code, customer_name, customer_contact, customer_email, prize_won, spun_at")
      .eq("shop_id", data.shopId).not("spun_at", "is", null)
      .order("spun_at", { ascending: false }).limit(50);

    return { shop, owner, prizes: prizes ?? [], codes: codes ?? [], spins: spins ?? [] };
  });

