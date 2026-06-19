import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listAllShops, setShopActive, deleteShop, claimShop } from "@/lib/shops.functions";

export const Route = createFileRoute("/_authenticated/super-admin")({
  head: () => ({ meta: [{ title: "Super admin — Lucky Spin" }] }),
  component: SuperAdminPage,
});

type EnrichedShop = {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  created_at: string;
  owner_user_id: string | null;
  owner_email: string | null;
  codes_count: number;
  spins_count: number;
};

function SuperAdminPage() {
  const fetchAll = useServerFn(listAllShops);
  const doSetActive = useServerFn(setShopActive);
  const doDelete = useServerFn(deleteShop);
  const doClaim = useServerFn(claimShop);
  const [shops, setShops] = useState<EnrichedShop[]>([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchAll();
      setShops(res.shops as EnrichedShop[]);
      setErr("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    } finally { setLoading(false); }
  }, [fetchAll]);
  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;
  if (err) return <div className="min-h-screen flex items-center justify-center text-destructive">{err}</div>;

  return (
    <div className="min-h-screen px-4 py-5 max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-gold">Super admin</p>
          <h1 className="text-2xl font-black">All shops ({shops.length})</h1>
        </div>
        <Link to="/dashboard" className="text-sm px-3 py-2 rounded-lg bg-white/5">← Back to dashboard</Link>
      </div>

      <div className="space-y-2">
        {shops.map((s) => (
          <div key={s.id} className="glass rounded-xl p-4">
            <div className="flex justify-between items-start gap-2 flex-wrap">
              <div>
                <p className="font-bold">{s.name} <span className="text-xs text-muted-foreground font-mono">/s/{s.slug}</span></p>
                <p className="text-xs text-muted-foreground">{s.owner_email || (s.owner_user_id ? "Owner (no email)" : "Unclaimed")} · created {new Date(s.created_at).toLocaleDateString()}</p>
                <p className="text-xs mt-1">{s.codes_count} codes · {s.spins_count} spins · {s.is_active ? <span className="text-emerald-400">active</span> : <span className="text-destructive">suspended</span>}</p>
              </div>
              <div className="flex gap-1 flex-wrap text-xs">
                {!s.owner_user_id && <button onClick={async () => { await doClaim({ data: { id: s.id } }); load(); }} className="px-2 py-1 rounded bg-primary text-[#0F1115] font-bold">Claim</button>}
                <button onClick={async () => { await doSetActive({ data: { id: s.id, is_active: !s.is_active } }); load(); }} className="px-2 py-1 rounded bg-white/5">
                  {s.is_active ? "Suspend" : "Reactivate"}
                </button>
                <button onClick={async () => { if (confirm(`Delete shop "${s.name}" and all its data?`)) { await doDelete({ data: { id: s.id } }); load(); } }} className="px-2 py-1 rounded bg-destructive/20 text-destructive">Delete</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
