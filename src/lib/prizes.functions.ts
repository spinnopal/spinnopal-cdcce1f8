import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2)
  .max(40)
  .regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/);

const prizeInput = z.object({
  id: z.string().trim().min(1).max(64).regex(/^[a-z0-9-]+$/i),
  name: z.string().trim().min(1).max(80),
  short: z.string().trim().min(1).max(40),
  image_url: z.string().trim().min(1).max(15_000_000),
  is_win: z.boolean(),
  probability: z.number().int().min(0).max(1000),
  sort_order: z.number().int().min(0).max(1000),
});

async function assertOwner(ctx: { supabase: any; userId: string }, shopId: string) {
  const { data, error } = await ctx.supabase
    .from("shops")
    .select("id")
    .eq("id", shopId)
    .eq("owner_user_id", ctx.userId)
    .maybeSingle();
  if (error || !data) throw new Error("Not authorized for this shop");
}

// PUBLIC: list prizes by slug (used by customer spin page)
export const listPrizesBySlug = createServerFn({ method: "GET" })
  .inputValidator(z.object({ slug: slugSchema }).parse)
  .handler(async ({ data }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    });
    const { data: shop } = await sb
      .from("shops_public")
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
    if (error) throw new Error(error.message);
    return { prizes: prizes ?? [] };
  });

// AUTH: list prizes for a shop I own
export const listMyPrizes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ shopId: z.string().uuid() }).parse)
  .handler(async ({ data, context }) => {
    await assertOwner(context, data.shopId);
    const { data: prizes, error } = await context.supabase
      .from("prizes")
      .select("id, name, short, image_url, is_win, probability, sort_order")
      .eq("shop_id", data.shopId)
      .order("sort_order", { ascending: true });
    if (error) throw new Error(error.message);
    return { prizes: prizes ?? [] };
  });

export const upsertPrize = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ shopId: z.string().uuid(), prize: prizeInput }).parse)
  .handler(async ({ data, context }) => {
    await assertOwner(context, data.shopId);
    const { error } = await context.supabase
      .from("prizes")
      .upsert({ ...data.prize, shop_id: data.shopId }, { onConflict: "shop_id,id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deletePrize = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ shopId: z.string().uuid(), id: z.string().min(1).max(64) }).parse)
  .handler(async ({ data, context }) => {
    await assertOwner(context, data.shopId);
    const { error } = await context.supabase
      .from("prizes")
      .delete()
      .eq("shop_id", data.shopId)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateProbabilities = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      shopId: z.string().uuid(),
      probs: z
        .array(z.object({ id: z.string(), probability: z.number().int().min(0).max(1000) }))
        .max(50),
    }).parse,
  )
  .handler(async ({ data, context }) => {
    await assertOwner(context, data.shopId);
    for (const p of data.probs) {
      const { error } = await context.supabase
        .from("prizes")
        .update({ probability: p.probability })
        .eq("shop_id", data.shopId)
        .eq("id", p.id);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

// PUBLIC: pick winner for a shop slug
export const pickWinnerForSlug = createServerFn({ method: "POST" })
  .inputValidator(z.object({ slug: slugSchema }).parse)
  .handler(async ({ data }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    });
    const { data: shop } = await sb
      .from("shops")
      .select("id")
      .eq("slug", data.slug)
      .eq("is_active", true)
      .maybeSingle();
    if (!shop) throw new Error("Shop not found");
    const { data: list, error } = await sb
      .from("prizes")
      .select("id, probability")
      .eq("shop_id", shop.id)
      .order("sort_order", { ascending: true });
    if (error) throw new Error(error.message);
    const items = list ?? [];
    if (items.length === 0) throw new Error("No prizes configured");
    const pool = items.filter((p) => (p.probability ?? 0) > 0);
    const cand = pool.length > 0 ? pool : items;
    const total = cand.reduce((s, p) => s + (p.probability || 1), 0) || 1;
    let r = Math.random() * total;
    for (const p of cand) {
      r -= p.probability || 1;
      if (r <= 0) return { id: p.id };
    }
    return { id: cand[0].id };
  });
