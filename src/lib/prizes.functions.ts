import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const ADMIN_PASSWORD = "mmz-admin-2024";

export const listPrizes = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("prizes")
    .select("id, name, short, image_url, is_win, probability, sort_order")
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  return { prizes: data ?? [] };
});

const adminBase = z.object({ password: z.string().min(1).max(128) });

const prizeInput = z.object({
  id: z.string().trim().min(1).max(64).regex(/^[a-z0-9-]+$/i),
  name: z.string().trim().min(1).max(80),
  short: z.string().trim().min(1).max(40),
  image_url: z.string().trim().min(1).max(5_000_000),
  is_win: z.boolean(),
  probability: z.number().int().min(0).max(1000),
  sort_order: z.number().int().min(0).max(1000),
});

export const upsertPrize = createServerFn({ method: "POST" })
  .inputValidator(adminBase.extend({ prize: prizeInput }).parse)
  .handler(async ({ data }) => {
    checkAdminPassword(data.password);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("prizes")
      .upsert({ ...data.prize }, { onConflict: "id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deletePrize = createServerFn({ method: "POST" })
  .inputValidator(adminBase.extend({ id: z.string().min(1).max(64) }).parse)
  .handler(async ({ data }) => {
    checkAdminPassword(data.password);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("prizes").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateProbabilities = createServerFn({ method: "POST" })
  .inputValidator(
    adminBase.extend({
      probs: z.array(z.object({ id: z.string(), probability: z.number().int().min(0).max(1000) })).max(50),
    }).parse,
  )
  .handler(async ({ data }) => {
    checkAdminPassword(data.password);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    for (const p of data.probs) {
      const { error } = await supabaseAdmin
        .from("prizes")
        .update({ probability: p.probability })
        .eq("id", p.id);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const pickWinnerServer = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("prizes")
    .select("id, probability")
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  const list = data ?? [];
  if (list.length === 0) throw new Error("No prizes configured");
  const pool = list.filter((p) => (p.probability ?? 0) > 0);
  const cand = pool.length > 0 ? pool : list;
  const total = cand.reduce((s, p) => s + (p.probability || 1), 0) || 1;
  let r = Math.random() * total;
  for (const p of cand) {
    r -= p.probability || 1;
    if (r <= 0) return { id: p.id };
  }
  return { id: cand[0].id };
});
