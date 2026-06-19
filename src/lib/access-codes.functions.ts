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

const codeChars = z.string().trim().min(1).max(64).regex(/^[A-Za-z0-9-]+$/);

function publicClient() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { createClient } = require("@supabase/supabase-js") as typeof import("@supabase/supabase-js");
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

async function shopIdForSlug(slug: string): Promise<string | null> {
  const sb = publicClient();
  const { data } = await sb
    .from("shops")
    .select("id")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();
  return data?.id ?? null;
}

async function assertOwner(ctx: { supabase: any; userId: string }, shopId: string) {
  const { data, error } = await ctx.supabase
    .from("shops")
    .select("id")
    .eq("id", shopId)
    .eq("owner_user_id", ctx.userId)
    .maybeSingle();
  if (error || !data) throw new Error("Not authorized for this shop");
}

// ---------- PUBLIC ----------

export const validateAccessCode = createServerFn({ method: "POST" })
  .inputValidator(z.object({ slug: slugSchema, code: codeChars }).parse)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const shopId = await shopIdForSlug(data.slug);
    if (!shopId) return { ok: false as const, reason: "shop" as const };
    const normalized = data.code.toUpperCase();
    const { data: row, error } = await supabaseAdmin
      .from("access_codes")
      .select("code, is_used")
      .eq("shop_id", shopId)
      .eq("code", normalized)
      .maybeSingle();
    if (error) throw new Error("Server error");
    if (!row) return { ok: false as const, reason: "invalid" as const };
    if (row.is_used) return { ok: false as const, reason: "used" as const };
    return { ok: true as const, code: row.code };
  });

export const consumeAccessCode = createServerFn({ method: "POST" })
  .inputValidator(z.object({ slug: slugSchema, code: codeChars }).parse)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const shopId = await shopIdForSlug(data.slug);
    if (!shopId) return { ok: false as const };
    const normalized = data.code.toUpperCase();
    const { data: updated, error } = await supabaseAdmin
      .from("access_codes")
      .update({ is_used: true, spun_at: new Date().toISOString() })
      .eq("shop_id", shopId)
      .eq("code", normalized)
      .eq("is_used", false)
      .select("code")
      .maybeSingle();
    if (error) throw new Error("Server error");
    if (!updated) return { ok: false as const };
    return { ok: true as const };
  });

export const recordPrizeForCode = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      slug: slugSchema,
      code: codeChars,
      prize: z.string().trim().min(1).max(100),
      name: z.string().trim().min(1).max(60).optional(),
    }).parse,
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const shopId = await shopIdForSlug(data.slug);
    if (!shopId) return { ok: false };
    await supabaseAdmin
      .from("access_codes")
      .update({ prize_won: data.prize, customer_name: data.name ?? null })
      .eq("shop_id", shopId)
      .eq("code", data.code.toUpperCase());
    return { ok: true };
  });

// ---------- AUTH (shop owner) ----------

function randomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  const arr = new Uint32Array(8);
  crypto.getRandomValues(arr);
  for (let i = 0; i < 8; i++) out += alphabet[arr[i] % alphabet.length];
  return out;
}

export const generateAccessCodes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ shopId: z.string().uuid(), count: z.number().int().min(1).max(500) }).parse)
  .handler(async ({ data, context }) => {
    await assertOwner(context, data.shopId);
    const codes = new Set<string>();
    while (codes.size < data.count) codes.add(randomCode());
    const rows = Array.from(codes).map((code) => ({ code, shop_id: data.shopId }));
    const { data: inserted, error } = await context.supabase
      .from("access_codes")
      .insert(rows)
      .select("code");
    if (error) throw new Error(error.message);
    return { codes: (inserted ?? []).map((r: { code: string }) => r.code) };
  });

export const listAccessCodes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ shopId: z.string().uuid() }).parse)
  .handler(async ({ data, context }) => {
    await assertOwner(context, data.shopId);
    const { data: rows, error } = await context.supabase
      .from("access_codes")
      .select("code, is_used, spun_at, prize_won, customer_name, created_at")
      .eq("shop_id", data.shopId)
      .order("created_at", { ascending: false })
      .limit(1000);
    if (error) throw new Error(error.message);
    return { rows: rows ?? [] };
  });

export const deleteUnusedCodes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ shopId: z.string().uuid() }).parse)
  .handler(async ({ data, context }) => {
    await assertOwner(context, data.shopId);
    const { error } = await context.supabase
      .from("access_codes")
      .delete()
      .eq("shop_id", data.shopId)
      .eq("is_used", false);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listSpinRecords = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ shopId: z.string().uuid() }).parse)
  .handler(async ({ data, context }) => {
    await assertOwner(context, data.shopId);
    const { data: rows, error } = await context.supabase
      .from("access_codes")
      .select("code, spun_at, prize_won, customer_name")
      .eq("shop_id", data.shopId)
      .not("prize_won", "is", null)
      .order("spun_at", { ascending: false })
      .limit(2000);
    if (error) throw new Error(error.message);
    return { rows: rows ?? [] };
  });

export const deleteSpinRecord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ shopId: z.string().uuid(), code: z.string().min(1).max(64) }).parse)
  .handler(async ({ data, context }) => {
    await assertOwner(context, data.shopId);
    const { error } = await context.supabase
      .from("access_codes")
      .update({ prize_won: null, customer_name: null, spun_at: null, is_used: false })
      .eq("shop_id", data.shopId)
      .eq("code", data.code.toUpperCase());
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const resetSpinRecords = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ shopId: z.string().uuid() }).parse)
  .handler(async ({ data, context }) => {
    await assertOwner(context, data.shopId);
    const { error } = await context.supabase
      .from("access_codes")
      .update({ prize_won: null, customer_name: null, spun_at: null, is_used: false })
      .eq("shop_id", data.shopId)
      .not("prize_won", "is", null);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
