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

async function publicClient() {
  const { createClient } = await import("@supabase/supabase-js");
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

async function shopIdForSlug(slug: string): Promise<string | null> {
  const sb = await publicClient();
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

// Atomic: consume the code, pick a winner server-side, and record the prize.
// Replaces the old client-driven consume + pick + record flow that allowed
// clients to spoof which prize was recorded.
export const spinAndRecord = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      slug: slugSchema,
      code: codeChars,
      name: z.string().trim().min(1).max(60).optional(),
      contact: z.union([z.string().trim().min(5).max(30).regex(/^[+\d][\d\s\-()]{4,29}$/), z.literal("")]).optional(),
      email: z.union([z.string().trim().toLowerCase().email().max(255), z.literal("")]).optional(),
    }).parse,
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const shopId = await shopIdForSlug(data.slug);
    if (!shopId) return { ok: false as const, reason: "shop" as const };
    const normalized = data.code.toUpperCase();

    // 1) Atomically consume the access code (only if currently unused).
    const { data: consumed, error: consumeErr } = await supabaseAdmin
      .from("access_codes")
      .update({ is_used: true, spun_at: new Date().toISOString() })
      .eq("shop_id", shopId)
      .eq("code", normalized)
      .eq("is_used", false)
      .select("code")
      .maybeSingle();
    if (consumeErr) throw new Error("Server error");
    if (!consumed) return { ok: false as const, reason: "invalid" as const };

    // 2) Server-side weighted random pick from this shop's prizes.
    const { data: prizes, error: prizesErr } = await supabaseAdmin
      .from("prizes")
      .select("id, name, short, image_url, is_win, probability, sort_order")
      .eq("shop_id", shopId)
      .order("sort_order", { ascending: true });
    if (prizesErr) throw new Error("Server error");
    const items = prizes ?? [];
    if (items.length === 0) throw new Error("No prizes configured");
    const pool = items.filter((p) => (p.probability ?? 0) > 0);
    const cand = pool.length > 0 ? pool : items;
    const total = cand.reduce((s, p) => s + (p.probability || 1), 0) || 1;
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    let r = (buf[0] / 0xffffffff) * total;
    let winner = cand[0];
    for (const p of cand) {
      r -= p.probability || 1;
      if (r <= 0) { winner = p; break; }
    }

    // 3) Record the server-picked prize. Client never supplies the prize name.
    const { error: recordErr } = await supabaseAdmin
      .from("access_codes")
      .update({
        prize_won: String(winner.name).slice(0, 100),
        customer_name: data.name ?? null,
        customer_contact: data.contact ? data.contact : null,
        customer_email: data.email ? data.email : null,
      })
      .eq("shop_id", shopId)
      .eq("code", normalized);
    if (recordErr) throw new Error("Server error");

    return { ok: true as const, prize: winner };
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
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const codes = new Set<string>();
    while (codes.size < data.count) codes.add(randomCode());
    const rows = Array.from(codes).map((code) => ({ code, shop_id: data.shopId }));
    const { data: inserted, error } = await supabaseAdmin
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
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("access_codes")
      .select("code, is_used, spun_at, prize_won, customer_name, customer_contact, customer_email, created_at")
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
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
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
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
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
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
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
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("access_codes")
      .update({ prize_won: null, customer_name: null, spun_at: null, is_used: false })
      .eq("shop_id", data.shopId)
      .not("prize_won", "is", null);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
