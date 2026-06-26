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

async function publicShopIdForSlug(slug: string): Promise<string | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: shop, error } = await supabaseAdmin
    .from("shops")
    .select("id, is_active, subscription_status, trial_ends_at, current_period_end")
    .eq("slug", slug)
    .maybeSingle();
  if (error || !shop || !shop.is_active) return null;

  const now = Date.now();
  const trialEnd = shop.trial_ends_at ? new Date(shop.trial_ends_at).getTime() : null;
  const periodEnd = shop.current_period_end ? new Date(shop.current_period_end).getTime() : null;
  if (shop.subscription_status === "suspended") return null;
  if (shop.subscription_status === "trial" && trialEnd && trialEnd < now) return null;
  if ((shop.subscription_status === "active" || shop.subscription_status === "past_due") && periodEnd && periodEnd < now) return null;
  return shop.id;
}

// PUBLIC: list prizes by slug (used by customer spin page)
export const listPrizesBySlug = createServerFn({ method: "GET" })
  .inputValidator(z.object({ slug: slugSchema }).parse)
  .handler(async ({ data }) => {
    const shopId = await publicShopIdForSlug(data.slug);
    if (!shopId) return { prizes: [] };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: prizes, error } = await supabaseAdmin
      .from("prizes")
      .select("id, name, short, image_url, is_win, probability, sort_order")
      .eq("shop_id", shopId)
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
    const shopId = await publicShopIdForSlug(data.slug);
    if (!shopId) throw new Error("Shop not found");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: list, error } = await supabaseAdmin
      .from("prizes")
      .select("id, probability")
      .eq("shop_id", shopId)
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
