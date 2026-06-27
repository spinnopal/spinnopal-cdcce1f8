import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  LayoutDashboard, Megaphone, Users, BarChart3, Settings as SettingsIcon,
  Pencil, Gift, QrCode, UserSquare2, LogOut, ExternalLink, Shield, MessageSquare,
  TrendingUp, Trophy, Activity, Sparkles, ChevronRight, ChevronLeft,
  CircleDot, Calendar, Ticket, Hash, PlayCircle, Power,
  Search, Download, Trash2, X, Phone, Mail, Award, CheckCircle2, XCircle, ArrowUpDown, Loader2,
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, Tooltip as RTooltip, CartesianGrid,
} from "recharts";
import { SpinWheel } from "@/components/SpinWheel";
import { rowToPrize } from "@/lib/spin-store";
import { InstallAppButton } from "@/components/InstallAppButton";
import { supabase } from "@/integrations/supabase/client";
import { listMyShops, updateMyShop, createShop, bootstrapSuperAdmin, getMySubscription } from "@/lib/shops.functions";
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
import { MessagingTab } from "@/components/MessagingTab";

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

type TabKey =
  | "overview" | "campaign" | "customers" | "analytics" | "settings"
  | "codes" | "qr" | "messages";

const slugRe = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;
const autoSlug = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);

function TabMount({ active, children }: { active: boolean; children: ReactNode }) {
  const [mounted, setMounted] = useState(active);
  useEffect(() => { if (active) setMounted(true); }, [active]);
  if (!mounted) return null;
  return <div style={{ display: active ? undefined : "none" }}>{children}</div>;
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function Dashboard() {
  const navigate = useNavigate();
  const fetchMyShops = useServerFn(listMyShops);
  const doCreateShop = useServerFn(createShop);
  const doUpdateShop = useServerFn(updateMyShop);
  const doBootstrap = useServerFn(bootstrapSuperAdmin);

  const [shop, setShop] = useState<Shop | null>(null);
  const [superAdmin, setSuperAdmin] = useState(false);
  const [ownerName, setOwnerName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>("overview");

  const loadShop = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchMyShops();
      setSuperAdmin(res.superAdmin);
      const list = res.shops as Shop[];
      setShop(list[0] ?? null);
    } finally {
      setLoading(false);
    }
  }, [fetchMyShops]);

  useEffect(() => { loadShop(); }, [loadShop]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const u = data.user;
      const meta = (u?.user_metadata ?? {}) as Record<string, unknown>;
      const name = (meta.full_name as string) || (meta.name as string) || u?.email?.split("@")[0] || "";
      setOwnerName(name);
    });
  }, []);

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

  const navItems: { key: TabKey; label: string; icon: typeof LayoutDashboard }[] = [
    { key: "overview", label: "Dashboard", icon: LayoutDashboard },
    { key: "campaign", label: "Campaign", icon: Megaphone },
    { key: "customers", label: "Customers", icon: Users },
    { key: "analytics", label: "Analytics", icon: BarChart3 },
    { key: "settings", label: "Settings", icon: SettingsIcon },
  ];

  return (
    <div className="min-h-screen bg-white pb-28">
      <div className="px-4 sm:px-6 pt-5 max-w-5xl mx-auto">
        {/* Top: greeting + actions */}
        <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 mb-4">
          <div className="min-w-0">
            <p className="text-sm text-[#4a5b78]">
              {greeting()}{ownerName ? `, ${ownerName}` : ""} <span aria-hidden>👋</span>
            </p>
            <h1 className="truncate text-xl sm:text-2xl font-black text-[#0c2340] mt-0.5">{shop.name}</h1>
            <div className="mt-1.5 flex items-center gap-2 flex-wrap">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide ${shop.is_active ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-amber-50 text-amber-700 border border-amber-200"}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${shop.is_active ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`} />
                {shop.is_active ? "Campaign Active" : "Paused"}
              </span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <img src={shop.logo_url || DEFAULT_LOGO} alt="" className="w-11 h-11 rounded-2xl object-cover border border-[#0c2340]/10 shadow-sm" />
            <div className="hidden sm:flex gap-1.5">
              {superAdmin && (
                <Link to="/super-admin" className="p-2 rounded-xl bg-[#F5F7FA] hover:bg-[#ECEFF5] text-[#0c2340]" title="Super admin">
                  <Shield className="w-4 h-4" />
                </Link>
              )}
              <button onClick={signOut} className="p-2 rounded-xl bg-[#F5F7FA] hover:bg-[#ECEFF5] text-[#0c2340]" title="Sign out">
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </header>

        <SubscriptionBanner />

        <TabMount active={tab === "overview"}>
          <OverviewTab shop={shop} onNavigate={setTab} />
        </TabMount>
        <TabMount active={tab === "campaign"}><CampaignHub shop={shop} onSaved={loadShop} doUpdate={doUpdateShop} superAdmin={superAdmin} doBootstrap={doBootstrap} /></TabMount>
        <TabMount active={tab === "customers"}><RecordsTab shop={shop} /></TabMount>
        <TabMount active={tab === "analytics"}><StatsTab shop={shop} /></TabMount>
        <TabMount active={tab === "settings"}>
          <div className="space-y-4">
            <SettingsTab shop={shop} onSaved={loadShop} doUpdate={doUpdateShop} superAdmin={superAdmin} doBootstrap={doBootstrap} />
            <div className="glass rounded-2xl p-4 flex flex-wrap gap-2">
              <InstallAppButton variant="outline" size="sm" />
              <Link to="/s/$slug" params={{ slug: shop.slug }} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#F5F7FA] text-[#0c2340] text-sm hover:bg-[#ECEFF5]">
                <ExternalLink className="w-4 h-4" /> View public page
              </Link>
              {superAdmin && (
                <Link to="/super-admin" className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#F5F7FA] text-[#0c2340] text-sm hover:bg-[#ECEFF5]">
                  <Shield className="w-4 h-4" /> Super admin
                </Link>
              )}
              <button onClick={signOut} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#F5F7FA] text-[#0c2340] text-sm hover:bg-[#ECEFF5]">
                <LogOut className="w-4 h-4" /> Sign out
              </button>
            </div>
          </div>
        </TabMount>

        {/* Secondary tabs (reached via quick actions) */}
        <TabMount active={tab === "codes"}>
          <SecondaryHeader title="Access Codes" onBack={() => setTab("overview")} />
          <CodesTab shop={shop} />
        </TabMount>
        <TabMount active={tab === "qr"}>
          <SecondaryHeader title="QR Codes" onBack={() => setTab("overview")} />
          <QrTab shop={shop} />
        </TabMount>
        <TabMount active={tab === "messages"}>
          <SecondaryHeader title="Messages" onBack={() => setTab("overview")} />
          <MessagingTab shop={shop} />
        </TabMount>
      </div>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 inset-x-0 z-40 border-t border-[#0c2340]/10 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 pb-[env(safe-area-inset-bottom)]">
        <div className="max-w-5xl mx-auto grid grid-cols-5">
          {navItems.map(({ key, label, icon: Icon }) => {
            const active = tab === key || (key === "overview" && (tab === "codes" || tab === "qr" || tab === "messages"));
            return (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`flex flex-col items-center justify-center gap-0.5 py-2.5 text-[10px] font-semibold transition-colors ${active ? "text-[#FF6B00]" : "text-[#4a5b78] hover:text-[#0c2340]"}`}
              >
                <Icon className={`w-5 h-5 ${active ? "stroke-[2.4]" : ""}`} />
                <span>{label}</span>
                {active && <span className="absolute bottom-0 w-8 h-0.5 rounded-full bg-[#FF6B00] mt-0.5" />}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

function SecondaryHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <button onClick={onBack} className="text-sm px-2.5 py-1.5 rounded-lg bg-[#F5F7FA] text-[#0c2340] hover:bg-[#ECEFF5]">← Back</button>
      <h2 className="text-lg font-black text-[#0c2340]">{title}</h2>
    </div>
  );
}

// ---------- OVERVIEW ----------
function OverviewTab({ shop, onNavigate }: { shop: Shop; onNavigate: (t: TabKey) => void }) {
  const fetchRecords = useServerFn(listSpinRecords);
  const fetchCodes = useServerFn(listAccessCodes);
  const [rows, setRows] = useState<RecordRow[]>([]);
  const [codes, setCodes] = useState<CodeRow[]>([]);

  useEffect(() => {
    fetchRecords({ data: { shopId: shop.id } }).then((r) => setRows((r.rows as RecordRow[]) ?? []));
    fetchCodes({ data: { shopId: shop.id } }).then((r) => setCodes((r.rows as CodeRow[]) ?? []));
  }, [fetchRecords, fetchCodes, shop.id]);

  const stats = useMemo(() => {
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const today = rows.filter((r) => r.spun_at && new Date(r.spun_at).getTime() >= todayStart.getTime()).length;
    const winners = rows.filter((r) => r.prize_won && !/try\s*again/i.test(r.prize_won)).length;
    const totalCodes = codes.length;
    const conversion = totalCodes > 0 ? Math.round((rows.length / totalCodes) * 100) : 0;
    const dist: Record<string, number> = {};
    for (const r of rows) {
      const k = r.prize_won || "Unknown";
      if (/try\s*again/i.test(k)) continue;
      dist[k] = (dist[k] || 0) + 1;
    }
    const top = Object.entries(dist).sort((a, b) => b[1] - a[1])[0];
    // weekly buckets
    const days: { day: string; spins: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - i);
      const next = new Date(d); next.setDate(d.getDate() + 1);
      const count = rows.filter((r) => {
        if (!r.spun_at) return false;
        const t = new Date(r.spun_at).getTime();
        return t >= d.getTime() && t < next.getTime();
      }).length;
      days.push({ day: d.toLocaleDateString(undefined, { weekday: "short" }), spins: count });
    }
    return { today, total: rows.length, winners, conversion, top, days };
  }, [rows, codes]);

  const recent = rows.slice(0, 6);

  const statCards = [
    { label: "Today's Spins", value: stats.today, icon: Activity, accent: "bg-orange-50 text-[#FF6B00]" },
    { label: "Total Spins", value: stats.total, icon: TrendingUp, accent: "bg-blue-50 text-blue-600" },
    { label: "Winners", value: stats.winners, icon: Trophy, accent: "bg-emerald-50 text-emerald-600" },
    { label: "Conversion", value: `${stats.conversion}%`, icon: Sparkles, accent: "bg-violet-50 text-violet-600" },
  ];

  const actions = [
    { label: "Edit Campaign", icon: Pencil, onClick: () => onNavigate("campaign") },
    { label: "Manage Prizes", icon: Gift, onClick: () => onNavigate("campaign") },
    { label: "Generate QR", icon: QrCode, onClick: () => onNavigate("qr") },
    { label: "View Customers", icon: UserSquare2, onClick: () => onNavigate("customers") },
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Stats 2x2 */}
      <section className="grid grid-cols-2 gap-3">
        {statCards.map(({ label, value, icon: Icon, accent }) => (
          <div key={label} className="rounded-[20px] bg-white border border-[#0c2340]/8 shadow-[0_4px_20px_-8px_rgba(12,35,64,0.12)] p-4">
            <div className={`w-9 h-9 rounded-xl grid place-items-center ${accent}`}>
              <Icon className="w-4.5 h-4.5" strokeWidth={2.2} />
            </div>
            <p className="text-[11px] uppercase tracking-wide text-[#4a5b78] mt-3 font-semibold">{label}</p>
            <p className="text-2xl font-black text-[#0c2340] mt-0.5">{value}</p>
          </div>
        ))}
      </section>

      {/* Quick Actions */}
      <section>
        <h3 className="text-sm font-bold text-[#0c2340] mb-2.5 px-1">Quick Actions</h3>
        <div className="grid grid-cols-2 gap-3">
          {actions.map(({ label, icon: Icon, onClick }) => (
            <button
              key={label}
              onClick={onClick}
              className="group rounded-[20px] bg-white border border-[#0c2340]/8 shadow-[0_4px_20px_-8px_rgba(12,35,64,0.12)] p-4 text-left hover:border-[#FF6B00]/40 hover:shadow-[0_8px_24px_-8px_rgba(255,107,0,0.25)] transition-all"
            >
              <div className="w-10 h-10 rounded-xl grid place-items-center bg-orange-50 text-[#FF6B00] group-hover:bg-[#FF6B00] group-hover:text-white transition-colors">
                <Icon className="w-5 h-5" strokeWidth={2.2} />
              </div>
              <p className="text-sm font-bold text-[#0c2340] mt-3">{label}</p>
            </button>
          ))}
        </div>
      </section>

      {/* Weekly chart */}
      <section className="rounded-[20px] bg-white border border-[#0c2340]/8 shadow-[0_4px_20px_-8px_rgba(12,35,64,0.12)] p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-[#0c2340]">Weekly Spins</h3>
          <span className="text-[11px] text-[#4a5b78]">Last 7 days</span>
        </div>
        <div className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats.days} margin={{ top: 6, right: 6, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#0c234012" vertical={false} />
              <XAxis dataKey="day" stroke="#4a5b78" fontSize={11} tickLine={false} axisLine={false} />
              <RTooltip
                cursor={{ fill: "#FF6B0010" }}
                contentStyle={{ borderRadius: 12, border: "1px solid #0c234020", fontSize: 12 }}
              />
              <Bar dataKey="spins" fill="#FF6B00" radius={[8, 8, 0, 0]} maxBarSize={36} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Top prize */}
      <section className="rounded-[20px] p-5 bg-gradient-to-br from-[#FF6B00] to-[#ff8a3d] text-white shadow-[0_10px_30px_-12px_rgba(255,107,0,0.55)]">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-white/20 grid place-items-center">
            <Trophy className="w-6 h-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] uppercase tracking-wide font-bold opacity-80">Top Prize</p>
            <p className="text-lg font-black truncate">{stats.top ? stats.top[0] : "No wins yet"}</p>
          </div>
          {stats.top && (
            <div className="text-right">
              <p className="text-2xl font-black leading-none">{stats.top[1]}</p>
              <p className="text-[10px] uppercase tracking-wide opacity-80">awarded</p>
            </div>
          )}
        </div>
      </section>

      {/* Recent activity */}
      <section className="rounded-[20px] bg-white border border-[#0c2340]/8 shadow-[0_4px_20px_-8px_rgba(12,35,64,0.12)] p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-bold text-[#0c2340]">Recent Activity</h3>
          <button onClick={() => onNavigate("customers")} className="text-xs font-semibold text-[#FF6B00] hover:underline">View all</button>
        </div>
        {recent.length === 0 ? (
          <p className="text-sm text-[#4a5b78] py-6 text-center">No spins yet. Generate QR codes to get started.</p>
        ) : (
          <ul className="divide-y divide-[#0c2340]/8">
            {recent.map((r) => {
              const isWin = r.prize_won && !/try\s*again/i.test(r.prize_won);
              return (
                <li key={r.code} className="py-2.5 flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl grid place-items-center text-xs font-black ${isWin ? "bg-emerald-50 text-emerald-700" : "bg-[#F5F7FA] text-[#4a5b78]"}`}>
                    {(r.customer_name || "?").slice(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[#0c2340] truncate">{r.customer_name || "Anonymous"}</p>
                    <p className="text-xs text-[#4a5b78] truncate">{r.prize_won || "—"}</p>
                  </div>
                  <span className="text-[11px] text-[#4a5b78] whitespace-nowrap">
                    {r.spun_at ? new Date(r.spun_at).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : ""}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Messages shortcut */}
      <button
        onClick={() => onNavigate("messages")}
        className="w-full rounded-[20px] bg-white border border-[#0c2340]/8 shadow-[0_4px_20px_-8px_rgba(12,35,64,0.12)] p-4 flex items-center gap-3 text-left hover:border-[#FF6B00]/40 transition-colors"
      >
        <div className="w-10 h-10 rounded-xl bg-orange-50 text-[#FF6B00] grid place-items-center">
          <MessageSquare className="w-5 h-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-[#0c2340]">Send Messages</p>
          <p className="text-xs text-[#4a5b78]">WhatsApp & email broadcasts to winners</p>
        </div>
        <span className="text-[#FF6B00] text-lg">→</span>
      </button>

      <button
        onClick={() => onNavigate("codes")}
        className="w-full rounded-[20px] bg-white border border-[#0c2340]/8 shadow-[0_4px_20px_-8px_rgba(12,35,64,0.12)] p-4 flex items-center gap-3 text-left hover:border-[#FF6B00]/40 transition-colors"
      >
        <div className="w-10 h-10 rounded-xl bg-orange-50 text-[#FF6B00] grid place-items-center">
          <Sparkles className="w-5 h-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-[#0c2340]">Access Codes</p>
          <p className="text-xs text-[#4a5b78]">Generate and manage spin codes</p>
        </div>
        <span className="text-[#FF6B00] text-lg">→</span>
      </button>
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
        <input value={name} onChange={(e) => { setName(e.target.value); if (!slug) setSlug(autoSlug(e.target.value)); }} placeholder="Shop name" className="w-full bg-[#F5F7FA] text-[#0c2340] placeholder:text-[#6b7a93] border border-[#0c2340]/10 rounded-xl px-4 py-3 outline-none focus:border-primary" />
        <div className="flex items-center bg-[#F5F7FA] text-[#0c2340] placeholder:text-[#6b7a93] border border-[#0c2340]/10 rounded-xl px-4 py-3">
          <span className="text-muted-foreground text-sm mr-1">/s/</span>
          <input value={slug} onChange={(e) => setSlug(autoSlug(e.target.value))} placeholder="my-shop" className="flex-1 bg-transparent outline-none" />
        </div>
        {err && <p className="text-destructive text-sm">{err}</p>}
        <button disabled={busy} className="w-full gradient-primary text-white font-bold py-3 rounded-xl disabled:opacity-60">
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
          <img src={logoUrl || DEFAULT_LOGO} alt="" className="w-20 h-20 rounded-full object-cover border border-[#0c2340]/10" />
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
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} className="w-full bg-[#F5F7FA] text-[#0c2340] placeholder:text-[#6b7a93] border border-[#0c2340]/10 rounded-xl px-4 py-3 outline-none focus:border-primary" />

        <label className="text-xs uppercase tracking-widest text-muted-foreground">Public URL</label>
        <div className="flex items-center bg-[#F5F7FA] text-[#0c2340] placeholder:text-[#6b7a93] border border-[#0c2340]/10 rounded-xl px-4 py-3">
          <span className="text-muted-foreground text-sm mr-1">/s/</span>
          <input value={slug} onChange={(e) => setSlug(autoSlug(e.target.value))} maxLength={40} className="flex-1 bg-transparent outline-none" />
        </div>
        <p className="text-[11px] text-muted-foreground break-all">Share: {publicUrl}</p>

        {err && <p className="text-destructive text-sm">{err}</p>}
        {msg && <p className="text-sm text-gold">{msg}</p>}
        <button onClick={save} disabled={busy} className="w-full gradient-primary text-white font-bold py-3 rounded-xl disabled:opacity-60">
          {busy ? "Saving..." : "Save changes"}
        </button>
      </div>

      {!superAdmin && (
        <div className="glass rounded-2xl p-5 space-y-2">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Platform admin (optional)</p>
          <p className="text-xs text-muted-foreground">If you are the platform owner, enter the admin password to unlock the super-admin panel.</p>
          <div className="flex gap-2">
            <input type="password" value={bootstrapPw} onChange={(e) => setBootstrapPw(e.target.value)} placeholder="Admin password" className="flex-1 bg-[#F5F7FA] text-[#0c2340] placeholder:text-[#6b7a93] border border-[#0c2340]/10 rounded-xl px-4 py-2 outline-none" />
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
        <button onClick={() => setEditing(newPrize())} className="px-3 py-2 rounded-lg bg-primary text-white font-bold text-sm">+ Add prize</button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {prizes.map((p) => (
          <div key={p.id} className="glass rounded-xl p-3 flex gap-3 items-center">
            <img src={p.image_url} alt="" className="w-14 h-14 rounded-lg object-cover bg-[#F5F7FA] text-[#0c2340]" />
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
              <img src={editing.image_url || DEFAULT_LOGO} alt="" className="w-16 h-16 rounded-lg object-cover bg-[#F5F7FA] text-[#0c2340]" />
              <label className="text-sm px-3 py-2 rounded-lg bg-white/5 cursor-pointer">
                Upload image
                <input type="file" accept="image/*" onChange={onImage} className="hidden" />
              </label>
            </div>
            <input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="Prize name" maxLength={80} className="w-full bg-[#F5F7FA] text-[#0c2340] placeholder:text-[#6b7a93] border border-[#0c2340]/10 rounded-lg px-3 py-2 outline-none" />
            <input value={editing.short} onChange={(e) => setEditing({ ...editing, short: e.target.value })} placeholder="Short label (for wheel)" maxLength={40} className="w-full bg-[#F5F7FA] text-[#0c2340] placeholder:text-[#6b7a93] border border-[#0c2340]/10 rounded-lg px-3 py-2 outline-none" />
            <div className="flex items-center gap-2">
              <label className="text-sm flex items-center gap-2">
                <input type="checkbox" checked={editing.is_win} onChange={(e) => setEditing({ ...editing, is_win: e.target.checked })} />
                Counts as win
              </label>
            </div>
            <div className="flex gap-2 text-sm">
              <label className="flex-1">
                Weight (odds)
                <input type="number" min={0} max={1000} value={editing.probability} onChange={(e) => setEditing({ ...editing, probability: parseInt(e.target.value || "0") })} className="w-full bg-[#F5F7FA] text-[#0c2340] placeholder:text-[#6b7a93] border border-[#0c2340]/10 rounded-lg px-3 py-2 outline-none" />
              </label>
              <label className="flex-1">
                Sort order
                <input type="number" min={0} max={1000} value={editing.sort_order} onChange={(e) => setEditing({ ...editing, sort_order: parseInt(e.target.value || "0") })} className="w-full bg-[#F5F7FA] text-[#0c2340] placeholder:text-[#6b7a93] border border-[#0c2340]/10 rounded-lg px-3 py-2 outline-none" />
              </label>
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={() => setEditing(null)} className="flex-1 py-2 rounded-lg bg-white/5">Cancel</button>
              <button onClick={save} disabled={busy} className="flex-1 py-2 rounded-lg gradient-primary text-white font-bold disabled:opacity-60">{busy ? "Saving..." : "Save"}</button>
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
        <input type="number" min={1} max={500} value={count} onChange={(e) => setCount(parseInt(e.target.value || "0"))} className="w-20 bg-[#F5F7FA] text-[#0c2340] placeholder:text-[#6b7a93] border border-[#0c2340]/10 rounded-lg px-2 py-2 outline-none" />
        <button onClick={gen} className="px-3 py-2 rounded-lg bg-primary text-white font-bold text-sm">Generate</button>
        <button onClick={delUnused} className="px-3 py-2 rounded-lg bg-destructive/20 text-destructive text-sm">Delete unused</button>
        <div className="ml-auto flex gap-1 text-xs">
          {(["all", "unused", "used"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={`px-2 py-1 rounded ${filter === f ? "bg-primary text-white font-bold" : "bg-white/5"}`}>{f}</button>
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
type RecordRow = { code: string; spun_at: string | null; prize_won: string | null; customer_name: string | null; customer_contact: string | null; customer_email: string | null };

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
    return !s || (r.customer_name || "").toLowerCase().includes(s) || (r.customer_contact || "").toLowerCase().includes(s) || (r.customer_email || "").toLowerCase().includes(s) || (r.prize_won || "").toLowerCase().includes(s) || r.code.toLowerCase().includes(s);
  });

  const exportCsv = async () => {
    if (rows.length === 0) return alert("No records to export.");
    const data = [["Name", "Contact", "Email", "Code", "Prize", "Date", "Time"]];
    for (const r of rows) {
      const d = r.spun_at ? new Date(r.spun_at) : null;
      data.push([
        (r.customer_name || "").replace(/"/g, '""'),
        (r.customer_contact || "").replace(/"/g, '""'),
        (r.customer_email || "").replace(/"/g, '""'),
        r.code,
        (r.prize_won || "").replace(/"/g, '""'),
        d ? d.toLocaleDateString() : "",
        d ? d.toLocaleTimeString() : "",
      ]);
    }
    const csv = "\ufeff" + data.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const filename = `${shop.slug}-records-${new Date().toISOString().slice(0, 10)}.csv`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });

    // 1) System file picker (Android Chrome / Edge / desktop Chromium).
    //    Opens the native "Save to..." dialog so the user can pick Downloads,
    //    Drive, SD card, etc. — no blob URL involved.
    type SaveFilePicker = (opts: {
      suggestedName?: string;
      types?: { description?: string; accept: Record<string, string[]> }[];
    }) => Promise<{
      createWritable: () => Promise<{ write: (d: Blob) => Promise<void>; close: () => Promise<void> }>;
    }>;
    const win = window as Window & { showSaveFilePicker?: SaveFilePicker };
    if (typeof win.showSaveFilePicker === "function") {
      try {
        const handle = await win.showSaveFilePicker({
          suggestedName: filename,
          types: [{ description: "CSV file", accept: { "text/csv": [".csv"] } }],
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        return;
      } catch (e) {
        // User cancelled — stop here, don't double-trigger a download.
        if (e instanceof DOMException && e.name === "AbortError") return;
        // Other errors (permission, unsupported) → fall through to fallbacks.
      }
    }

    // 2) Native Share sheet with file (iOS Safari, Android browsers without picker).
    try {
      const file = new File([blob], filename, { type: "text/csv" });
      const nav = navigator as Navigator & {
        canShare?: (d: { files: File[] }) => boolean;
        share?: (d: { files: File[]; title?: string }) => Promise<void>;
      };
      if (nav.canShare?.({ files: [file] }) && nav.share) {
        await nav.share({ files: [file], title: filename });
        return;
      }
    } catch { /* fall through */ }

    // 3) Anchor download fallback (older browsers).
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 1000);
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2 items-center">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name / contact / email / code / prize" className="flex-1 bg-[#F5F7FA] text-[#0c2340] placeholder:text-[#6b7a93] border border-[#0c2340]/10 rounded-lg px-3 py-2 outline-none" />
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
            {(r.customer_contact || r.customer_email) && (
              <div className="text-xs text-muted-foreground mt-1">
                {r.customer_contact && <span className="mr-3">{r.customer_contact}</span>}
                {r.customer_email && <span>{r.customer_email}</span>}
              </div>
            )}
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
          <button onClick={() => window.print()} className="px-3 py-2 rounded-lg bg-primary text-white font-bold text-sm">Print this page</button>
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

function SubscriptionBanner() {
  const fetchSub = useServerFn(getMySubscription);
  const [sub, setSub] = useState<{ plan: string; subscription_status: string; trial_ends_at: string | null; current_period_end: string | null } | null>(null);
  useEffect(() => {
    fetchSub().then((r) => { if (r.shop) setSub(r.shop as any); }).catch(() => {});
  }, [fetchSub]);
  if (!sub) return null;
  const end = sub.current_period_end ?? sub.trial_ends_at;
  const expired = end ? new Date(end).getTime() < Date.now() : false;
  const daysLeft = end ? Math.ceil((new Date(end).getTime() - Date.now()) / 86400000) : null;
  const tone =
    sub.subscription_status === "suspended" || expired ? "bg-destructive/20 border-destructive/40 text-destructive" :
    sub.subscription_status === "trial" || sub.subscription_status === "past_due" ? "bg-amber-500/10 border-amber-500/30 text-amber-200" :
    "bg-emerald-500/10 border-emerald-500/30 text-emerald-200";
  return (
    <div className={`mb-4 rounded-xl border px-3 py-2 text-xs flex justify-between items-center gap-2 flex-wrap ${tone}`}>
      <div>
        <span className="font-bold uppercase mr-2">{sub.plan}</span>
        <span className="uppercase">{sub.subscription_status}</span>
        {end && (
          <span className="ml-2 opacity-80">
            {expired ? `Expired ${new Date(end).toLocaleDateString()}` : `${daysLeft} day${daysLeft === 1 ? "" : "s"} left · ${new Date(end).toLocaleDateString()}`}
          </span>
        )}
      </div>
      {(sub.subscription_status !== "active" || expired) && (
        <span className="opacity-80">Contact admin to activate / renew.</span>
      )}
    </div>
  );
}

// ---------- CAMPAIGN HUB ----------
type HubSection = "overview" | "prizes" | "wheel" | "qr-codes" | "settings";

function CampaignHub({
  shop, onSaved, doUpdate, superAdmin, doBootstrap,
}: {
  shop: Shop;
  onSaved: () => void;
  doUpdate: ReturnType<typeof useServerFn<typeof updateMyShop>>;
  superAdmin: boolean;
  doBootstrap: ReturnType<typeof useServerFn<typeof bootstrapSuperAdmin>>;
}) {
  const fetchPrizes = useServerFn(listMyPrizes);
  const fetchCodes = useServerFn(listAccessCodes);
  const fetchSub = useServerFn(getMySubscription);

  const [section, setSection] = useState<HubSection>("overview");
  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [codes, setCodes] = useState<CodeRow[]>([]);
  const [sub, setSub] = useState<{ trial_ends_at: string | null; current_period_end: string | null; subscription_status: string; created_at?: string } | null>(null);
  const [busyStatus, setBusyStatus] = useState(false);

  const reload = useCallback(() => {
    fetchPrizes({ data: { shopId: shop.id } }).then((r) => setPrizes(r.prizes as Prize[]));
    fetchCodes({ data: { shopId: shop.id } }).then((r) => setCodes((r.rows as CodeRow[]) ?? []));
  }, [fetchPrizes, fetchCodes, shop.id]);

  useEffect(() => { reload(); }, [reload]);
  useEffect(() => {
    fetchSub().then((r) => { if (r.shop) setSub(r.shop as any); }).catch(() => {});
  }, [fetchSub]);

  const totalCodes = codes.length;
  const remainingCodes = codes.filter((c) => !c.is_used).length;
  const endDate = sub?.current_period_end ?? sub?.trial_ends_at ?? null;
  const startDate = (sub as any)?.created_at ?? null;
  const fmt = (d: string | null) => d ? new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "—";

  const toggleActive = async () => {
    setBusyStatus(true);
    try {
      await doUpdate({ data: { id: shop.id, is_active: !shop.is_active } });
      onSaved();
    } finally { setBusyStatus(false); }
  };

  if (section !== "overview") {
    const titles: Record<Exclude<HubSection, "overview">, string> = {
      prizes: "Prizes",
      wheel: "Spin Wheel",
      "qr-codes": "QR & Access Codes",
      settings: "Campaign Settings",
    };
    return (
      <div className="space-y-4 animate-fade-in">
        <button
          onClick={() => setSection("overview")}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#0c2340] px-3 py-2 rounded-xl bg-[#F5F7FA] hover:bg-[#ECEFF5]"
        >
          <ChevronLeft className="w-4 h-4" /> Campaign Hub
        </button>
        <h2 className="text-xl font-black text-[#0c2340]">{titles[section]}</h2>
        {section === "prizes" && <PrizesTab shop={shop} />}
        {section === "wheel" && <WheelSection shop={shop} prizes={prizes} onEditColors={() => setSection("settings")} onAssign={() => setSection("prizes")} />}
        {section === "qr-codes" && (
          <div className="space-y-6">
            <QrTab shop={shop} />
            <div className="pt-2 border-t border-[#0c2340]/10">
              <h3 className="text-base font-black text-[#0c2340] mb-3">Access Codes</h3>
              <CodesTab shop={shop} />
            </div>
          </div>
        )}
        {section === "settings" && (
          <SettingsTab shop={shop} onSaved={onSaved} doUpdate={doUpdate} superAdmin={superAdmin} doBootstrap={doBootstrap} />
        )}
      </div>
    );
  }

  const stats = [
    { label: "Total Prizes", value: prizes.length, icon: Gift },
    { label: "Total Codes", value: totalCodes, icon: Ticket },
    { label: "Remaining", value: remainingCodes, icon: Hash },
  ];

  const cards: { key: Exclude<HubSection, "overview">; title: string; emoji: string; icon: typeof Gift; desc: string; actions: string[] }[] = [
    { key: "prizes", title: "Prizes", emoji: "🎁", icon: Gift,
      desc: "Manage your reward catalog and inventory.",
      actions: ["View prizes", "Add prize", "Edit prize", "Prize inventory"] },
    { key: "wheel", title: "Spin Wheel", emoji: "🎡", icon: PlayCircle,
      desc: "Preview the wheel and test how it spins.",
      actions: ["Preview wheel", "Edit wheel colors", "Assign prizes", "Test spin"] },
    { key: "qr-codes", title: "QR & Access Codes", emoji: "🔳", icon: QrCode,
      desc: "Generate, print and export everything customers need.",
      actions: ["Generate QR", "Download QR", "Print QR", "Generate codes", "Export CSV"] },
    { key: "settings", title: "Campaign Settings", emoji: "⚙️", icon: SettingsIcon,
      desc: "Odds, limits, expiry and terms.",
      actions: ["Winning probability", "Daily spin limit", "Campaign expiry", "Terms & Conditions"] },
  ];

  return (
    <div className="space-y-5 animate-fade-in pb-4">
      {/* Header card */}
      <section className="rounded-[20px] bg-white border border-[#0c2340]/8 shadow-[0_4px_20px_-8px_rgba(12,35,64,0.12)] p-5">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wide text-[#4a5b78] font-bold">Campaign</p>
            <h2 className="text-xl sm:text-2xl font-black text-[#0c2340] truncate mt-0.5">{shop.name}</h2>
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide ${shop.is_active ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-amber-50 text-amber-700 border border-amber-200"}`}>
                <CircleDot className={`w-3 h-3 ${shop.is_active ? "text-emerald-500" : "text-amber-500"}`} />
                {shop.is_active ? "Active" : "Paused"}
              </span>
            </div>
          </div>
          <button
            onClick={toggleActive}
            disabled={busyStatus}
            className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-colors disabled:opacity-60 ${shop.is_active ? "bg-white text-[#0c2340] border-[#0c2340]/15 hover:bg-[#F5F7FA]" : "bg-[#FF6B00] text-white border-[#FF6B00] hover:bg-[#e85f00]"}`}
          >
            <Power className="w-4 h-4" /> {shop.is_active ? "Pause" : "Activate"}
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-[#F8FAFC] border border-[#0c2340]/8 p-3">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide font-bold text-[#4a5b78]"><Calendar className="w-3.5 h-3.5" /> Start</div>
            <p className="text-sm font-bold text-[#0c2340] mt-1">{fmt(startDate)}</p>
          </div>
          <div className="rounded-2xl bg-[#F8FAFC] border border-[#0c2340]/8 p-3">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide font-bold text-[#4a5b78]"><Calendar className="w-3.5 h-3.5" /> Ends</div>
            <p className="text-sm font-bold text-[#0c2340] mt-1">{fmt(endDate)}</p>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-3">
          {stats.map(({ label, value, icon: Icon }) => (
            <div key={label} className="rounded-2xl bg-[#F8FAFC] border border-[#0c2340]/8 p-3">
              <Icon className="w-4 h-4 text-[#FF6B00]" />
              <p className="text-[10px] uppercase tracking-wide text-[#4a5b78] font-bold mt-1.5">{label}</p>
              <p className="text-xl font-black text-[#0c2340]">{value}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Management cards */}
      <section className="space-y-3">
        {cards.map(({ key, title, emoji, icon: Icon, desc, actions }) => (
          <button
            key={key}
            onClick={() => setSection(key)}
            className="w-full text-left rounded-[20px] bg-white border border-[#0c2340]/8 shadow-[0_4px_20px_-8px_rgba(12,35,64,0.12)] p-5 hover:border-[#FF6B00]/40 hover:shadow-[0_8px_24px_-8px_rgba(255,107,0,0.25)] transition-all"
          >
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-2xl grid place-items-center bg-orange-50 text-2xl shrink-0">
                <span aria-hidden>{emoji}</span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Icon className="w-4 h-4 text-[#FF6B00]" />
                  <h3 className="text-base font-black text-[#0c2340]">{title}</h3>
                </div>
                <p className="text-xs text-[#4a5b78] mt-1">{desc}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {actions.map((a) => (
                    <span key={a} className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#F5F7FA] text-[#0c2340] border border-[#0c2340]/8">
                      {a}
                    </span>
                  ))}
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-[#4a5b78] shrink-0 mt-1" />
            </div>
          </button>
        ))}
      </section>

      {/* Launch / Update */}
      <div className="sticky bottom-20 z-10">
        <button
          onClick={toggleActive}
          disabled={busyStatus}
          className="w-full py-4 rounded-2xl bg-[#FF6B00] hover:bg-[#e85f00] text-white font-black text-base shadow-[0_12px_32px_-12px_rgba(255,107,0,0.6)] disabled:opacity-60 transition-colors"
        >
          {busyStatus ? "Saving…" : shop.is_active ? "Update Campaign" : "Launch Campaign"}
        </button>
      </div>
    </div>
  );
}

// ---------- WHEEL PREVIEW ----------
function WheelSection({ shop, prizes, onEditColors, onAssign }: { shop: Shop; prizes: Prize[]; onEditColors: () => void; onAssign: () => void }) {
  const [spinning, setSpinning] = useState(false);
  const [target, setTarget] = useState<number | null>(null);
  const [last, setLast] = useState<string | null>(null);

  const wheelPrizes = useMemo(() => prizes.map((p) => rowToPrize(p as any)), [prizes]);

  const testSpin = () => {
    if (wheelPrizes.length === 0 || spinning) return;
    const idx = Math.floor(Math.random() * wheelPrizes.length);
    setTarget(idx);
    setSpinning(true);
    setLast(null);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-[20px] bg-white border border-[#0c2340]/8 shadow-[0_4px_20px_-8px_rgba(12,35,64,0.12)] p-5">
        {wheelPrizes.length === 0 ? (
          <p className="text-sm text-[#4a5b78] text-center py-10">Add prizes first to preview the wheel.</p>
        ) : (
          <div className="flex flex-col items-center">
            <SpinWheel
              prizes={wheelPrizes}
              spinning={spinning}
              targetIndex={target}
              onComplete={(p) => { setSpinning(false); setTarget(null); setLast(p.name); }}
              centerLogo={shop.logo_url ?? undefined}
              centerLabel={shop.name}
            />
            {last && (
              <p className="mt-3 text-sm font-bold text-[#0c2340]">Landed on: <span className="text-[#FF6B00]">{last}</span></p>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <button onClick={testSpin} disabled={spinning || wheelPrizes.length === 0} className="rounded-2xl bg-[#FF6B00] hover:bg-[#e85f00] text-white font-bold py-3 disabled:opacity-60">
          {spinning ? "Spinning…" : "Test spin"}
        </button>
        <button onClick={onAssign} className="rounded-2xl bg-white border border-[#0c2340]/10 hover:bg-[#F5F7FA] text-[#0c2340] font-bold py-3">
          Assign prizes
        </button>
        <button onClick={onEditColors} className="rounded-2xl bg-white border border-[#0c2340]/10 hover:bg-[#F5F7FA] text-[#0c2340] font-bold py-3">
          Edit wheel colors
        </button>
      </div>
    </div>
  );
}
