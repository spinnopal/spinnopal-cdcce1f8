import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

function checkAdminPassword(pw: string) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) throw new Error("Admin password not configured");
  if (pw !== expected) throw new Error("Unauthorized");
}

const codeSchema = z.object({
  code: z.string().trim().min(1).max(64).regex(/^[A-Za-z0-9-]+$/),
});

export const validateAccessCode = createServerFn({ method: "POST" })
  .inputValidator(codeSchema.parse)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const normalized = data.code.toUpperCase();
    const { data: row, error } = await supabaseAdmin
      .from("access_codes")
      .select("code, is_used")
      .eq("code", normalized)
      .maybeSingle();
    if (error) throw new Error("Server error");
    if (!row) return { ok: false as const, reason: "invalid" as const };
    if (row.is_used) return { ok: false as const, reason: "used" as const };
    return { ok: true as const, code: row.code };
  });

export const consumeAccessCode = createServerFn({ method: "POST" })
  .inputValidator(codeSchema.parse)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const normalized = data.code.toUpperCase();
    // Atomic: only update if not used yet
    const { data: updated, error } = await supabaseAdmin
      .from("access_codes")
      .update({ is_used: true, spun_at: new Date().toISOString() })
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
      code: z.string().trim().min(1).max(64).regex(/^[A-Za-z0-9-]+$/),
      prize: z.string().trim().min(1).max(100),
      name: z.string().trim().min(1).max(60).optional(),
    }).parse,
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("access_codes")
      .update({ prize_won: data.prize, customer_name: data.name ?? null })
      .eq("code", data.code.toUpperCase());
    return { ok: true };
  });


// ---- Admin ----

const adminSchema = z.object({ password: z.string().min(1).max(128) });

function randomCode() {
  // 8 chars, unambiguous alphabet
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  const arr = new Uint32Array(8);
  crypto.getRandomValues(arr);
  for (let i = 0; i < 8; i++) out += alphabet[arr[i] % alphabet.length];
  return out;
}

export const generateAccessCodes = createServerFn({ method: "POST" })
  .inputValidator(
    adminSchema.extend({ count: z.number().int().min(1).max(500) }).parse,
  )
  .handler(async ({ data }) => {
    checkAdminPassword(data.password);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const codes = new Set<string>();
    while (codes.size < data.count) codes.add(randomCode());
    const rows = Array.from(codes).map((code) => ({ code }));
    const { data: inserted, error } = await supabaseAdmin
      .from("access_codes")
      .insert(rows)
      .select("code");
    if (error) throw new Error(error.message);
    return { codes: (inserted ?? []).map((r) => r.code) };
  });

export const listAccessCodes = createServerFn({ method: "POST" })
  .inputValidator(adminSchema.parse)
  .handler(async ({ data }) => {
    checkAdminPassword(data.password);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("access_codes")
      .select("code, is_used, spun_at, prize_won, customer_name, created_at")
      .order("created_at", { ascending: false })
      .limit(1000);
    if (error) throw new Error(error.message);
    return { rows: rows ?? [] };
  });

export const deleteUnusedCodes = createServerFn({ method: "POST" })
  .inputValidator(adminSchema.parse)
  .handler(async ({ data }) => {
    checkAdminPassword(data.password);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("access_codes")
      .delete()
      .eq("is_used", false);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listSpinRecords = createServerFn({ method: "POST" })
  .inputValidator(adminSchema.parse)
  .handler(async ({ data }) => {
    checkAdminPassword(data.password);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("access_codes")
      .select("code, spun_at, prize_won, customer_name")
      .not("prize_won", "is", null)
      .order("spun_at", { ascending: false })
      .limit(2000);
    if (error) throw new Error(error.message);
    return { rows: rows ?? [] };
  });

export const deleteSpinRecord = createServerFn({ method: "POST" })
  .inputValidator(adminSchema.extend({ code: z.string().min(1).max(64) }).parse)
  .handler(async ({ data }) => {
    checkAdminPassword(data.password);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("access_codes")
      .update({ prize_won: null, customer_name: null, spun_at: null, is_used: false })
      .eq("code", data.code.toUpperCase());
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const resetSpinRecords = createServerFn({ method: "POST" })
  .inputValidator(adminSchema.parse)
  .handler(async ({ data }) => {
    checkAdminPassword(data.password);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("access_codes")
      .update({ prize_won: null, customer_name: null, spun_at: null, is_used: false })
      .not("prize_won", "is", null);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
