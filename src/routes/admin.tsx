import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  PRIZES,
  deleteRecord,
  exportCsv,
  getProbs,
  getRecords,
  resetCampaign,
  setProbs,
  type PrizeId,
} from "@/lib/spin-store";
import {
  deleteUnusedCodes,
  generateAccessCodes,
  listAccessCodes,
} from "@/lib/access-codes.functions";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin — Mas Mobile Zone" }] }),
  component: AdminPage,
});

type CodeRow = {
  code: string;
  is_used: boolean;
  spun_at: string | null;
  prize_won: string | null;
  created_at: string;
};

function AdminPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<"stats" | "records" | "probs" | "codes">("codes");
  const [query, setQuery] = useState("");
  const [tick, setTick] = useState(0);
  const records = useMemo(() => getRecords(), [tick]);
  const probs = useMemo(() => getProbs(), [tick]);

  const filtered = records.filter((r) =>
    r.name.toLowerCase().includes(query.toLowerCase()) ||
    r.prizeName.toLowerCase().includes(query.toLowerCase())
  );

  const stats = useMemo(() => {
    const total = records.length;
    const winners = records.filter((r) => r.isWin).length;
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const today = records.filter((r) => r.timestamp >= todayStart.getTime()).length;
    const dist: Record<string, number> = {};
    for (const r of records) dist[r.prizeName] = (dist[r.prizeName] || 0) + 1;
    const most = Object.entries(dist).sort((a, b) => b[1] - a[1])[0];
    return { total, winners, today, dist, most };
  }, [records]);

  const handleExport = () => {
    const csv = exportCsv();
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mmz-records-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const updateProb = (id: PrizeId, value: number) => {
    const next = { ...probs, [id]: Math.max(0, Math.min(100, value)) };
    setProbs(next);
    setTick((t) => t + 1);
  };

  return (
    <div className="min-h-screen px-4 py-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => navigate({ to: "/" })} className="text-sm text-muted-foreground">← Home</button>
        <h1 className="text-lg font-black tracking-widest">ADMIN PANEL</h1>
        <span className="w-10" />
      </div>

      <div className="glass rounded-2xl p-1 flex gap-1 mb-5">
        {(["codes", "stats", "records", "probs"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-xl text-sm font-semibold uppercase tracking-wider transition ${
              tab === t ? "gradient-primary text-[#0F1115]" : "text-muted-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "codes" && <CodesTab />}

      {tab === "stats" && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Total Spins" value={stats.total} />
            <Stat label="Winners" value={stats.winners} />
            <Stat label="Today" value={stats.today} />
          </div>
          <div className="glass rounded-2xl p-4">
            <p className="text-xs uppercase tracking-widest text-muted-foreground mb-3">Prize Distribution</p>
            {PRIZES.map((p) => {
              const count = stats.dist[p.name] || 0;
              const pct = stats.total ? Math.round((count / stats.total) * 100) : 0;
              return (
                <div key={p.id} className="mb-3 last:mb-0">
                  <div className="flex justify-between text-sm mb-1">
                    <span>{p.short}</span>
                    <span className="text-muted-foreground">{count} ({pct}%)</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                    <div className="h-full gradient-primary" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
          {stats.most && (
            <div className="glass rounded-2xl p-4">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Most Won</p>
              <p className="text-lg font-bold text-gold mt-1">{stats.most[0]}</p>
            </div>
          )}
          <div className="flex gap-3">
            <button onClick={handleExport} className="flex-1 py-3 rounded-xl bg-secondary font-semibold">Export CSV</button>
            <button
              onClick={() => {
                if (confirm("Reset all records?")) { resetCampaign(); setTick((t) => t + 1); }
              }}
              className="flex-1 py-3 rounded-xl bg-destructive/80 text-destructive-foreground font-semibold"
            >
              Reset Campaign
            </button>
          </div>
        </div>
      )}

      {tab === "records" && (
        <div>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or prize..."
            className="w-full bg-[#0F1115]/70 border border-white/10 rounded-xl px-4 py-3 mb-3 outline-none focus:border-primary"
          />
          <div className="space-y-2">
            {filtered.length === 0 && <p className="text-muted-foreground text-center py-8">No records</p>}
            {filtered.map((r) => (
              <div key={r.id} className="glass rounded-xl p-3 flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold truncate font-mono text-sm">{r.name}</p>
                  <p className={`text-xs ${r.isWin ? "text-gold" : "text-muted-foreground"}`}>{r.prizeName}</p>
                  <p className="text-[10px] text-muted-foreground">{new Date(r.timestamp).toLocaleString()}</p>
                </div>
                <button
                  onClick={() => { deleteRecord(r.id); setTick((t) => t + 1); }}
                  className="text-destructive text-sm px-2 py-1"
                >Delete</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "probs" && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">Weighted probabilities (any positive values; they're normalized).</p>
          {PRIZES.map((p) => (
            <div key={p.id} className="glass rounded-xl p-3">
              <div className="flex justify-between items-center mb-2">
                <span className="font-semibold text-sm">{p.short}</span>
                <input
                  type="number"
                  value={probs[p.id]}
                  onChange={(e) => updateProb(p.id, Number(e.target.value))}
                  className="w-20 bg-[#0F1115] border border-white/10 rounded-lg px-2 py-1 text-right"
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="glass rounded-2xl p-4 text-center">
      <p className="text-2xl font-black text-gold">{value}</p>
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1">{label}</p>
    </div>
  );
}

function CodesTab() {
  const generate = useServerFn(generateAccessCodes);
  const list = useServerFn(listAccessCodes);
  const purge = useServerFn(deleteUnusedCodes);

  const [password, setPassword] = useState(() => sessionStorage.getItem("mmz_admin_pw") || "");
  const [authed, setAuthed] = useState(false);
  const [rows, setRows] = useState<CodeRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [count, setCount] = useState(50);
  const [filter, setFilter] = useState<"all" | "used" | "unused">("all");
  const [lastBatch, setLastBatch] = useState<string[]>([]);

  const refresh = async (pw: string) => {
    setLoading(true);
    setError("");
    try {
      const res = await list({ data: { password: pw } });
      setRows(res.rows as CodeRow[]);
      setAuthed(true);
      sessionStorage.setItem("mmz_admin_pw", pw);
    } catch {
      setError("Incorrect password.");
      setAuthed(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (password) refresh(password);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleGenerate = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await generate({ data: { password, count } });
      setLastBatch(res.codes);
      await refresh(password);
    } catch {
      setError("Failed to generate codes.");
    } finally {
      setLoading(false);
    }
  };

  const handlePurge = async () => {
    if (!confirm("Delete ALL unused codes? This cannot be undone.")) return;
    setLoading(true);
    try {
      await purge({ data: { password } });
      await refresh(password);
    } catch {
      setError("Failed to delete codes.");
    } finally {
      setLoading(false);
    }
  };

  const downloadBatch = (codes: string[]) => {
    const text = codes.join("\n");
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mmz-codes-${new Date().toISOString().slice(0,16).replace(/[:T]/g,"-")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!authed) {
    return (
      <div className="glass rounded-2xl p-5 space-y-3">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Admin Password</p>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && refresh(password)}
          placeholder="Enter admin password"
          className="w-full bg-[#0F1115]/70 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-primary"
        />
        {error && <p className="text-destructive text-sm">{error}</p>}
        <button
          onClick={() => refresh(password)}
          disabled={loading}
          className="w-full gradient-primary text-[#0F1115] font-bold py-3 rounded-xl disabled:opacity-60"
        >
          {loading ? "Checking..." : "Unlock"}
        </button>
        <p className="text-[11px] text-muted-foreground">Default: mmz-admin-2024</p>
      </div>
    );
  }

  const filtered = rows.filter((r) =>
    filter === "all" ? true : filter === "used" ? r.is_used : !r.is_used,
  );

  const usedCount = rows.filter((r) => r.is_used).length;
  const unusedCount = rows.length - usedCount;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Total" value={rows.length} />
        <Stat label="Used" value={usedCount} />
        <Stat label="Unused" value={unusedCount} />
      </div>

      <div className="glass rounded-2xl p-4 space-y-3">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Generate Codes</p>
        <div className="flex gap-2">
          <input
            type="number"
            min={1}
            max={500}
            value={count}
            onChange={(e) => setCount(Math.max(1, Math.min(500, Number(e.target.value) || 1)))}
            className="w-24 bg-[#0F1115] border border-white/10 rounded-lg px-3 py-2 text-right"
          />
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="flex-1 gradient-primary text-[#0F1115] font-bold py-2 rounded-lg disabled:opacity-60"
          >
            {loading ? "Generating..." : `Generate ${count} codes`}
          </button>
        </div>
        {lastBatch.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs text-gold">Last batch: {lastBatch.length} codes</p>
              <button
                onClick={() => downloadBatch(lastBatch)}
                className="text-xs px-3 py-1 rounded bg-secondary"
              >Download .txt</button>
            </div>
            <div className="max-h-32 overflow-auto bg-[#0F1115]/70 rounded-lg p-2 font-mono text-xs grid grid-cols-2 gap-1">
              {lastBatch.map((c) => <span key={c}>{c}</span>)}
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        {(["all", "unused", "used"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`flex-1 py-2 rounded-lg text-xs uppercase tracking-wider ${
              filter === f ? "gradient-primary text-[#0F1115] font-bold" : "bg-secondary text-muted-foreground"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="space-y-2 max-h-[55vh] overflow-auto">
        {filtered.length === 0 && <p className="text-muted-foreground text-center py-8">No codes</p>}
        {filtered.map((r) => (
          <div key={r.code} className="glass rounded-xl p-3 flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="font-mono font-bold tracking-widest">{r.code}</p>
              {r.is_used ? (
                <>
                  <p className="text-xs text-gold">{r.prize_won || "—"}</p>
                  <p className="text-[10px] text-muted-foreground">
                    Used {r.spun_at ? new Date(r.spun_at).toLocaleString() : ""}
                  </p>
                </>
              ) : (
                <p className="text-xs text-muted-foreground">Unused</p>
              )}
            </div>
            <span className={`text-[10px] uppercase tracking-widest px-2 py-1 rounded ${
              r.is_used ? "bg-destructive/30 text-destructive-foreground" : "bg-emerald-500/20 text-emerald-300"
            }`}>
              {r.is_used ? "Used" : "Active"}
            </span>
          </div>
        ))}
      </div>

      <button
        onClick={handlePurge}
        disabled={loading || unusedCount === 0}
        className="w-full py-3 rounded-xl bg-destructive/80 text-destructive-foreground font-semibold disabled:opacity-50"
      >
        Delete all unused codes
      </button>
    </div>
  );
}
