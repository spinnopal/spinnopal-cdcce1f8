import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { listMyShops, updateMyShop, createShop, bootstrapSuperAdmin } from "@/lib/shops.functions";
import {
  listMyPrizes,
  upsertPrize,
  deletePrize,
  updateProbabilities,
} from "@/lib/prizes.functions";
import {
  generateAccessCodes,
  listAccessCodes,
  deleteUnusedCodes,
  listSpinRecords,
  deleteSpinRecord,
  resetSpinRecords,
} from "@/lib/access-codes.functions";
import { DEFAULT_LOGO } from "@/lib/spin-store";
import { QRCodeSVG } from "qrcode.react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Lucky Spin" }] }),
  component: Dashboard,
});

type Shop = {
  id: string;
  owner_user_id: string | null;
  name: string;
  slug: string;
  logo_url: string | null;
  is_active: boolean;
};

type Prize = {
  id: string;
  name: string;
  short: string;
  image_url: string;
  is_win: boolean;
  probability: number;
  sort_order: number;
};

type CodeRow = {
  code: string;
  is_used: boolean;
  spun_at: string | null;
  prize_won: string | null;
  customer_name: string | null;
  created_at: string;
};

const slugRe = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;
const autoSlug = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);

function Dashboard() {
  const navigate = useNavigate();
  const fetchMyShops = useServerFn(listMyShops);
  const doCreateShop = useServerFn(createShop);
  const doUpdateShop = useServerFn(updateMyShop);
  const doBootstrap = useServerFn(bootstrapSuperAdmin);

  const [shop, setShop] = useState<Shop | null>(null);
  const [superAdmin, setSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"prizes" | "codes" | "qr" | "records" | "stats" | "settings">("settings");

  const loadShop = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchMyShops();
      setSuperAdmin(res.superAdmin);
      const list = res.shops as Shop[];
      setShop(list[0] ?? null);
      if (list[0] && tab === "settings" && !shop) setTab("prizes");
    } finally {
      setLoading(false);
    }
  }, [fetchMyShops]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadShop();
  }, [loadShop]);

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;
  }

  if (!shop) {
    return <CreateShopForm onCreated={loadShop} onSignOut={signOut} doCreate={doCreateShop} />;
  }

  return (
    <div className="min-h-screen px-4 py-5 max-w-5xl mx-auto">
      <header className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <div className="flex items-center gap-3">
          <img src={shop.logo_url || DEFAULT_LOGO} alt="" className="w-10 h-10 rounded-full object-cover border border-white/10" />
          <div>
            <p className="text-xs uppercase tracking-widest text-gold">Dashboard</p>
            <p className="font-bold leading-tight">{shop.name}</p>
          </div>
        </div>
        <div className="flex gap-2 items-center text-xs">
          <Link to="/s/$slug" params={{ slug: shop.slug }} className="px-3 py-2 rounded-lg border border-white/15 hover:border-primary">
            View public page
          </Link>
          {superAdmin && (
            <Link to="/super-admin" className="px-3 py-2 rounded-lg bg-white/5">
              Super admin
            </Link>
          )}
          <button onClick={signOut} className="px-3 py-2 rounded-lg bg-white/5">Sign out</button>
        </div>
      </header>

      <nav className="flex gap-1 mb-4 overflow-x-auto">
        {(["prizes", "codes", "qr", "records", "stats", "settings"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-2 rounded-lg text-sm capitalize ${tab === t ? "bg-primary text-[#0F1115] font-bold" : "bg-white/5"}`}
          >
            {t === "qr" ? "QR Codes" : t}
          </button>
        ))}
      </nav>

      <TabMount active={tab === "settings"}><SettingsTab shop={shop} onSaved={loadShop} doUpdate={doUpdateShop} superAdmin={superAdmin} doBootstrap={doBootstrap} /></TabMount>
      <TabMount active={tab === "prizes"}><PrizesTab shop={shop} /></TabMount>
      <TabMount active={tab === "codes"}><CodesTab shop={shop} /></TabMount>
      <TabMount active={tab === "qr"}><QrTab shop={shop} /></TabMount>
      <TabMount active={tab === "records"}><RecordsTab shop={shop} /></TabMount>
      <TabMount active={tab === "stats"}><StatsTab shop={shop} /></TabMount>
    </div>
  );
}

function CreateShopForm({ onCreated, onSignOut, doCreate }: { onCreated: () => void; onSignOut: () => void; doCreate: ReturnType<typeof useServerFn<typeof createShop>> }) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      const desired = slug || autoSlug(name);
      if (!name.trim()) throw new Error("Shop name is required");
      if (!slugRe.test(desired)) throw new Error("Invalid URL slug");
      await doCreate({ data: { name: name.trim(), slug: desired } });
      onCreated();
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Failed to create shop");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <form onSubmit={submit} className="glass rounded-2xl p-6 w-full max-w-sm space-y-3">
        <p className="text-xs uppercase tracking-widest text-gold">Create your shop</p>
        <input value={name} onChange={(e) => { setName(e.target.value); if (!slug) setSlug(autoSlug(e.target.value)); }} placeholder="Shop name" className="w-full bg-[#0F1115]/70 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-primary" />
        <div className="flex items-center bg-[#0F1115]/70 border border-white/10 rounded-xl px-4 py-3">
          <span className="text-muted-foreground text-sm mr-1">/s/</span>
          <input value={slug} onChange={(e) => setSlug(autoSlug(e.target.value))} placeholder="my-shop" className="flex-1 bg-transparent outline-none" />
        </div>
        {err && <p className="text-destructive text-sm">{err}</p>}
        <button disabled={busy} className="w-full gradient-primary text-[#0F1115] font-bold py-3 rounded-xl disabled:opacity-60">
          {busy ? "Creating..." : "Create shop"}
        </button>
        <button type="button" onClick={onSignOut} className="w-full text-xs text-muted-foreground">Sign out</button>
      </form>
    </div>
  );
}

// ---------- SETTINGS ----------
function SettingsTab({ shop, onSaved, doUpdate, superAdmin, doBootstrap }: { shop: Shop; onSaved: () => void; doUpdate: ReturnType<typeof useServerFn<typeof updateMyShop>>; superAdmin: boolean; doBootstrap: ReturnType<typeof useServerFn<typeof bootstrapSuperAdmin>> }) {
  const [name, setName] = useState(shop.name);
  const [slug, setSlug] = useState(shop.slug);
  const [logoUrl, setLogoUrl] = useState<string | null>(shop.logo_url);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [bootstrapPw, setBootstrapPw] = useState("");
  const [bootstrapMsg, setBootstrapMsg] = useState("");

  const onLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) { setErr("Logo must be under 10 MB"); return; }
    const reader = new FileReader();
    reader.onload = () => setLogoUrl(reader.result as string);
    reader.readAsDataURL(f);
  };

  const save = async () => {
    setErr(""); setMsg(""); setBusy(true);
    try {
      const patch: { id: string; name?: string; slug?: string; logo_url?: string | null } = { id: shop.id };
      if (name !== shop.name) patch.name = name.trim();
      if (slug !== shop.slug) {
        if (!slugRe.test(slug)) throw new Error("Slug can only contain lowercase letters, numbers and dashes");
        patch.slug = slug;
      }
      if (logoUrl !== shop.logo_url) patch.logo_url = logoUrl;
      await doUpdate({ data: patch });
      setMsg("Saved.");
      onSaved();
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Save failed");
    } finally { setBusy(false); }
  };

  const tryBootstrap = async () => {
    setBootstrapMsg("");
    try {
      await doBootstrap({ data: { password: bootstrapPw } });
      setBootstrapMsg("You are now a super admin. Refresh to see the link.");
    } catch (e) {
      setBootstrapMsg(e instanceof Error ? e.message : "Failed");
    }
  };

  const publicUrl = typeof window !== "undefined" ? `${window.location.origin}/s/${shop.slug}` : `/s/${shop.slug}`;

  return (
    <div className="space-y-4">
      <div className="glass rounded-2xl p-5 space-y-3">
        <p className="text-xs uppercase tracking-widest text-gold">Branding</p>

        <div className="flex items-center gap-4">
          <img src={logoUrl || DEFAULT_LOGO} alt="" className="w-20 h-20 rounded-full object-cover border border-white/10" />
          <div className="flex flex-col gap-2">
            <label className="cursor-pointer text-sm px-3 py-2 rounded-lg bg-white/5 inline-block">
              Upload logo
              <input type="file" accept="image/*" onChange={onLogo} className="hidden" />
            </label>
            {logoUrl && (
              <button onClick={() => setLogoUrl(null)} className="text-xs text-muted-foreground text-left">Remove logo</button>
            )}
            <p className="text-[11px] text-muted-foreground">PNG/JPG, up to 10 MB. Square works best.</p>
          </div>
        </div>

        <label className="text-xs uppercase tracking-widest text-muted-foreground">Shop name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} className="w-full bg-[#0F1115]/70 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-primary" />

        <label className="text-xs uppercase tracking-widest text-muted-foreground">Public URL</label>
        <div className="flex items-center bg-[#0F1115]/70 border border-white/10 rounded-xl px-4 py-3">
          <span className="text-muted-foreground text-sm mr-1">/s/</span>
          <input value={slug} onChange={(e) => setSlug(autoSlug(e.target.value))} maxLength={40} className="flex-1 bg-transparent outline-none" />
        </div>
        <p className="text-[11px] text-muted-foreground break-all">Share: {publicUrl}</p>

        {err && <p className="text-destructive text-sm">{err}</p>}
        {msg && <p className="text-sm text-gold">{msg}</p>}
        <button onClick={save} disabled={busy} className="w-full gradient-primary text-[#0F1115] font-bold py-3 rounded-xl disabled:opacity-60">
          {busy ? "Saving..." : "Save changes"}
        </button>
      </div>

      {!superAdmin && (
        <div className="glass rounded-2xl p-5 space-y-2">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Platform admin (optional)</p>
          <p className="text-xs text-muted-foreground">If you are the platform owner, enter the admin password to unlock the super-admin panel.</p>
          <div className="flex gap-2">
            <input type="password" value={bootstrapPw} onChange={(e) => setBootstrapPw(e.target.value)} placeholder="Admin password" className="flex-1 bg-[#0F1115]/70 border border-white/10 rounded-xl px-4 py-2 outline-none" />
            <button onClick={tryBootstrap} className="px-3 py-2 rounded-lg bg-white/5">Unlock</button>
          </div>
          {bootstrapMsg && <p className="text-xs">{bootstrapMsg}</p>}
        </div>
      )}
    </div>
  );
}

// ---------- PRIZES ----------
function PrizesTab({ shop }: { shop: Shop }) {
  const fetchPrizes = useServerFn(listMyPrizes);
  const doUpsert = useServerFn(upsertPrize);
  const doDelete = useServerFn(deletePrize);
  const doProbs = useServerFn(updateProbabilities);
  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [editing, setEditing] = useState<Prize | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetchPrizes({ data: { shopId: shop.id } });
    setPrizes(res.prizes as Prize[]);
  }, [fetchPrizes, shop.id]);
  useEffect(() => { load(); }, [load]);

  const newPrize = (): Prize => ({
    id: `prize-${Date.now().toString(36)}`,
    name: "",
    short: "",
    image_url: "",
    is_win: true,
    probability: 10,
    sort_order: prizes.length,
  });

  const save = async () => {
    if (!editing) return;
    if (!editing.name || !editing.short || !editing.image_url) return alert("Fill name, short label, and image.");
    setBusy(true);
    try {
      await doUpsert({ data: { shopId: shop.id, prize: editing } });
      setEditing(null);
      load();
    } finally { setBusy(false); }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this prize?")) return;
    await doDelete({ data: { shopId: shop.id, id } });
    load();
  };

  const onImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f || !editing) return;
    if (f.size > 10 * 1024 * 1024) return alert("Image must be under 10 MB.");
    const r = new FileReader();
    r.onload = () => setEditing({ ...editing, image_url: r.result as string });
    r.readAsDataURL(f);
  };

  const updateProb = async (id: string, v: number) => {
    setPrizes((ps) => ps.map((p) => (p.id === id ? { ...p, probability: v } : p)));
  };
  const saveProbs = async () => {
    await doProbs({ data: { shopId: shop.id, probs: prizes.map((p) => ({ id: p.id, probability: p.probability })) } });
    alert("Odds saved.");
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{prizes.length} prizes</p>
        <button onClick={() => setEditing(newPrize())} className="px-3 py-2 rounded-lg bg-primary text-[#0F1115] font-bold text-sm">+ Add prize</button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {prizes.map((p) => (
          <div key={p.id} className="glass rounded-xl p-3 flex gap-3 items-center">
            <img src={p.image_url} alt="" className="w-14 h-14 rounded-lg object-cover bg-[#0F1115]" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold truncate">{p.name}</p>
              <p className="text-xs text-muted-foreground">{p.is_win ? "Win" : "Try again"} · weight {p.probability}</p>
              <input type="range" min={0} max={100} value={p.probability} onChange={(e) => updateProb(p.id, parseInt(e.target.value))} className="w-full mt-1" />
            </div>
            <div className="flex flex-col gap-1">
              <button onClick={() => setEditing(p)} className="text-xs px-2 py-1 rounded bg-white/5">Edit</button>
              <button onClick={() => remove(p.id)} className="text-xs px-2 py-1 rounded bg-destructive/20 text-destructive">Delete</button>
            </div>
          </div>
        ))}
      </div>

      {prizes.length > 0 && <button onClick={saveProbs} className="w-full py-2 rounded-lg bg-white/5 text-sm">Save odds</button>}

      {editing && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end sm:items-center justify-center p-3">
          <div className="glass rounded-2xl p-4 w-full max-w-sm space-y-2">
            <p className="text-xs uppercase tracking-widest text-gold">{prizes.find((p) => p.id === editing.id) ? "Edit prize" : "New prize"}</p>
            <div className="flex items-center gap-3">
              <img src={editing.image_url || DEFAULT_LOGO} alt="" className="w-16 h-16 rounded-lg object-cover bg-[#0F1115]" />
              <label className="text-sm px-3 py-2 rounded-lg bg-white/5 cursor-pointer">
                Upload image
                <input type="file" accept="image/*" onChange={onImage} className="hidden" />
              </label>
            </div>
            <input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="Prize name" maxLength={80} className="w-full bg-[#0F1115]/70 border border-white/10 rounded-lg px-3 py-2 outline-none" />
            <input value={editing.short} onChange={(e) => setEditing({ ...editing, short: e.target.value })} placeholder="Short label (for wheel)" maxLength={40} className="w-full bg-[#0F1115]/70 border border-white/10 rounded-lg px-3 py-2 outline-none" />
            <div className="flex items-center gap-2">
              <label className="text-sm flex items-center gap-2">
                <input type="checkbox" checked={editing.is_win} onChange={(e) => setEditing({ ...editing, is_win: e.target.checked })} />
                Counts as win
              </label>
            </div>
            <div className="flex gap-2 text-sm">
              <label className="flex-1">
                Weight (odds)
                <input type="number" min={0} max={1000} value={editing.probability} onChange={(e) => setEditing({ ...editing, probability: parseInt(e.target.value || "0") })} className="w-full bg-[#0F1115]/70 border border-white/10 rounded-lg px-3 py-2 outline-none" />
              </label>
              <label className="flex-1">
                Sort order
                <input type="number" min={0} max={1000} value={editing.sort_order} onChange={(e) => setEditing({ ...editing, sort_order: parseInt(e.target.value || "0") })} className="w-full bg-[#0F1115]/70 border border-white/10 rounded-lg px-3 py-2 outline-none" />
              </label>
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={() => setEditing(null)} className="flex-1 py-2 rounded-lg bg-white/5">Cancel</button>
              <button onClick={save} disabled={busy} className="flex-1 py-2 rounded-lg gradient-primary text-[#0F1115] font-bold disabled:opacity-60">{busy ? "Saving..." : "Save"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- CODES ----------
function CodesTab({ shop }: { shop: Shop }) {
  const fetchCodes = useServerFn(listAccessCodes);
  const doGen = useServerFn(generateAccessCodes);
  const doDelUnused = useServerFn(deleteUnusedCodes);
  const [rows, setRows] = useState<CodeRow[]>([]);
  const [count, setCount] = useState(10);
  const [filter, setFilter] = useState<"all" | "unused" | "used">("all");

  const load = useCallback(async () => {
    const res = await fetchCodes({ data: { shopId: shop.id } });
    setRows((res.rows as CodeRow[]) ?? []);
  }, [fetchCodes, shop.id]);
  useEffect(() => { load(); }, [load]);

  const gen = async () => {
    await doGen({ data: { shopId: shop.id, count } });
    load();
  };
  const delUnused = async () => {
    if (!confirm("Delete all unused codes?")) return;
    await doDelUnused({ data: { shopId: shop.id } });
    load();
  };

  const filtered = rows.filter((r) => filter === "all" ? true : filter === "unused" ? !r.is_used : r.is_used);

  return (
    <div className="space-y-3">
      <div className="glass rounded-xl p-3 flex gap-2 items-center flex-wrap">
        <input type="number" min={1} max={500} value={count} onChange={(e) => setCount(parseInt(e.target.value || "0"))} className="w-20 bg-[#0F1115]/70 border border-white/10 rounded-lg px-2 py-2 outline-none" />
        <button onClick={gen} className="px-3 py-2 rounded-lg bg-primary text-[#0F1115] font-bold text-sm">Generate</button>
        <button onClick={delUnused} className="px-3 py-2 rounded-lg bg-destructive/20 text-destructive text-sm">Delete unused</button>
        <div className="ml-auto flex gap-1 text-xs">
          {(["all", "unused", "used"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={`px-2 py-1 rounded ${filter === f ? "bg-primary text-[#0F1115] font-bold" : "bg-white/5"}`}>{f}</button>
          ))}
        </div>
      </div>

      <div className="text-xs text-muted-foreground">{filtered.length} codes</div>

      <div className="space-y-1 max-h-[60vh] overflow-y-auto">
        {filtered.map((r) => (
          <div key={r.code} className="glass rounded-lg px-3 py-2 flex items-center gap-3 text-sm">
            <span className="font-mono tracking-widest">{r.code}</span>
            <span className={`text-xs px-2 py-0.5 rounded ${r.is_used ? "bg-destructive/30 text-destructive" : "bg-emerald-500/20 text-emerald-400"}`}>
              {r.is_used ? "used" : "unused"}
            </span>
            <span className="ml-auto text-xs text-muted-foreground truncate">
              {r.customer_name || ""}{r.prize_won ? ` · ${r.prize_won}` : ""}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- RECORDS ----------
type RecordRow = { code: string; spun_at: string | null; prize_won: string | null; customer_name: string | null };

function RecordsTab({ shop }: { shop: Shop }) {
  const fetchRecords = useServerFn(listSpinRecords);
  const doDel = useServerFn(deleteSpinRecord);
  const doReset = useServerFn(resetSpinRecords);
  const [rows, setRows] = useState<RecordRow[]>([]);
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    const res = await fetchRecords({ data: { shopId: shop.id } });
    setRows((res.rows as RecordRow[]) ?? []);
  }, [fetchRecords, shop.id]);
  useEffect(() => { load(); }, [load]);

  const filtered = rows.filter((r) => {
    const s = q.toLowerCase();
    return !s || (r.customer_name || "").toLowerCase().includes(s) || (r.prize_won || "").toLowerCase().includes(s) || r.code.toLowerCase().includes(s);
  });

  const exportCsv = () => {
    if (rows.length === 0) return alert("No records to export.");
    const data = [["Name", "Code", "Prize", "Date", "Time"]];
    for (const r of rows) {
      const d = r.spun_at ? new Date(r.spun_at) : null;
      data.push([
        (r.customer_name || "").replace(/"/g, '""'),
        r.code,
        (r.prize_won || "").replace(/"/g, '""'),
        d ? d.toLocaleDateString() : "",
        d ? d.toLocaleTimeString() : "",
      ]);
    }
    const csv = "\ufeff" + data.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${shop.slug}-records-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2 items-center">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name / code / prize" className="flex-1 bg-[#0F1115]/70 border border-white/10 rounded-lg px-3 py-2 outline-none" />
        <button onClick={exportCsv} className="px-3 py-2 rounded-lg bg-white/5 text-sm">Export CSV</button>
        <button onClick={async () => { if (confirm("Reset all spin records?")) { await doReset({ data: { shopId: shop.id } }); load(); } }} className="px-3 py-2 rounded-lg bg-destructive/20 text-destructive text-sm">Reset all</button>
      </div>

      <div className="space-y-1 max-h-[65vh] overflow-y-auto">
        {filtered.map((r) => (
          <div key={r.code} className="glass rounded-lg px-3 py-2 text-sm">
            <div className="flex justify-between">
              <span className="font-semibold">{r.customer_name || "—"}</span>
              <span className="text-xs text-muted-foreground">{r.spun_at ? new Date(r.spun_at).toLocaleString() : ""}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gold">{r.prize_won}</span>
              <span className="font-mono">{r.code}</span>
            </div>
            <button onClick={async () => { if (confirm("Delete this record?")) { await doDel({ data: { shopId: shop.id, code: r.code } }); load(); } }} className="text-[11px] text-destructive mt-1">Delete</button>
          </div>
        ))}
        {filtered.length === 0 && <p className="text-muted-foreground text-sm text-center py-8">No records yet.</p>}
      </div>
    </div>
  );
}

// ---------- STATS ----------
function StatsTab({ shop }: { shop: Shop }) {
  const fetchRecords = useServerFn(listSpinRecords);
  const [rows, setRows] = useState<RecordRow[]>([]);

  useEffect(() => {
    fetchRecords({ data: { shopId: shop.id } }).then((r) => setRows((r.rows as RecordRow[]) ?? []));
  }, [fetchRecords, shop.id]);

  const stats = useMemo(() => {
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const today = rows.filter((r) => r.spun_at && new Date(r.spun_at).getTime() >= todayStart.getTime()).length;
    const dist: Record<string, number> = {};
    for (const r of rows) { const k = r.prize_won || "Unknown"; dist[k] = (dist[k] || 0) + 1; }
    const most = Object.entries(dist).sort((a, b) => b[1] - a[1])[0];
    return { total: rows.length, today, dist, most };
  }, [rows]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <div className="glass rounded-xl p-4">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Total spins</p>
        <p className="text-3xl font-black mt-1">{stats.total}</p>
      </div>
      <div className="glass rounded-xl p-4">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Today</p>
        <p className="text-3xl font-black mt-1">{stats.today}</p>
      </div>
      <div className="glass rounded-xl p-4">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Most awarded</p>
        <p className="text-base font-bold mt-1">{stats.most ? `${stats.most[0]} (${stats.most[1]})` : "—"}</p>
      </div>
      <div className="glass rounded-xl p-4 sm:col-span-3">
        <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Prize distribution</p>
        <div className="space-y-1">
          {Object.entries(stats.dist).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
            <div key={k} className="flex justify-between text-sm">
              <span>{k}</span><span className="font-mono">{v}</span>
            </div>
          ))}
          {Object.keys(stats.dist).length === 0 && <p className="text-sm text-muted-foreground">No data yet.</p>}
        </div>
      </div>
    </div>
  );
}

// ---------- QR CODES ----------
function QrTab({ shop }: { shop: Shop }) {
  const fetchCodes = useServerFn(listAccessCodes);
  const [rows, setRows] = useState<CodeRow[]>([]);
  const [filter, setFilter] = useState<"all" | "unused">("unused");

  useEffect(() => {
    fetchCodes({ data: { shopId: shop.id } }).then((r) => setRows((r.rows as CodeRow[]) ?? []));
  }, [fetchCodes, shop.id]);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const shopUrl = `${origin}/s/${shop.slug}`;
  const codeUrl = (code: string) => `${origin}/s/${shop.slug}?code=${encodeURIComponent(code)}`;

  const list = rows.filter((r) => (filter === "unused" ? !r.is_used : true));

  return (
    <div className="space-y-4">
      <style>{`@media print {
        @page { margin: 12mm; }
        body * { visibility: hidden; }
        #qr-print, #qr-print * { visibility: visible; }
        #qr-print { position: absolute; left: 0; top: 0; width: 100%; background: white !important; color: black !important; padding: 0; }
        .no-print { display: none !important; }
        .qr-card { break-inside: avoid; page-break-inside: avoid; border: 1px solid #ddd !important; background: white !important; color: black !important; padding: 20px !important; }
        .qr-grid { gap: 24px !important; grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
        .qr-code svg { width: 170px !important; height: 170px !important; }
        .shop-qr svg { width: 240px !important; height: 240px !important; }
      }`}</style>

      <div className="glass rounded-2xl p-4 no-print space-y-2">
        <p className="text-xs uppercase tracking-widest text-gold">How it works</p>
        <p className="text-sm text-muted-foreground">
          Customers scan a QR with their phone camera and spin on their own device — no app required.
          The <span className="text-foreground font-semibold">Shop QR</span> opens the entry page where they enter any access code.
          A <span className="text-foreground font-semibold">Per-code QR</span> opens the entry page with the code already filled in — they just type their name and spin.
        </p>
        <div className="flex gap-2 flex-wrap pt-2">
          <button onClick={() => window.print()} className="px-3 py-2 rounded-lg bg-primary text-[#0F1115] font-bold text-sm">Print this page</button>
          <button onClick={() => setFilter(filter === "all" ? "unused" : "all")} className="px-3 py-2 rounded-lg bg-white/5 text-sm">
            Showing: {filter === "all" ? "All codes" : "Unused only"}
          </button>
        </div>
      </div>

      <div id="qr-print" className="space-y-6">
        <div className="qr-card glass rounded-2xl p-6 flex flex-col items-center text-center">
          <p className="text-xs uppercase tracking-widest text-gold">Shop QR — scan to spin</p>
          <h2 className="text-2xl font-black mt-1">{shop.name}</h2>
          <div className="qr-code mt-4 p-4 bg-white rounded-xl">
            <QRCodeSVG value={shopUrl} size={240} level="M" includeMargin={false} />
          </div>
          <p className="mt-3 text-xs break-all opacity-80">{shopUrl}</p>
          <p className="mt-2 text-[11px] opacity-70">Point your phone camera at the code to open the spin page.</p>
        </div>

        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-3 no-print">Per-code QRs ({list.length})</p>
          {list.length === 0 ? (
            <p className="text-sm text-muted-foreground no-print">No codes to show. Generate codes in the Codes tab first.</p>
          ) : (
            <div className="qr-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {list.map((r) => (
                <div key={r.code} className="qr-card glass rounded-xl p-5 flex flex-col items-center text-center">
                  <div className="qr-code p-3 bg-white rounded-lg">
                    <QRCodeSVG value={codeUrl(r.code)} size={170} level="M" includeMargin={false} />
                  </div>
                  <p className="mt-3 font-mono text-sm tracking-widest break-all">{r.code}</p>
                  <p className="text-xs opacity-70">{shop.name}</p>
                  {r.is_used && <p className="text-xs text-destructive no-print">used</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
