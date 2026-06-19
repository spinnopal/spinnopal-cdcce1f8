import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2)
  .max(40)
  .regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/, "Use lowercase letters, numbers and dashes only");

const nameSchema = z.string().trim().min(1).max(80);

function publicClient() {
  // Server-side publishable client for anon-readable data during SSR or public fns.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { createClient } = require("@supabase/supabase-js") as typeof import("@supabase/supabase-js");
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
    const sb = publicClient();
    const { data: shop, error } = await sb
      .from("shops")
      .select("id, name, slug, logo_url, is_active")
      .eq("slug", data.slug)
      .maybeSingle();
    if (error) throw new Error("Server error");
    if (!shop || !shop.is_active) return { shop: null as null };
    return { shop };
  });

export const getPublicPrizes = createServerFn({ method: "GET" })
  .inputValidator(z.object({ slug: slugSchema }).parse)
  .handler(async ({ data }) => {
    const sb = publicClient();
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
  .inputValidator(z.object({ name: nameSchema, slug: slugSchema }).parse)
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
        if (s.owner_user_id) {
          const { data: u } = await supabaseAdmin.auth.admin.getUserById(s.owner_user_id);
          ownerEmail = u.user?.email ?? null;
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
        return { ...s, owner_email: ownerEmail, codes_count: codes ?? 0, spins_count: spins ?? 0 };
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
