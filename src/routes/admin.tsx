import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
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

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin — Mas Mobile Zone" }] }),
  component: AdminPage,
});

function AdminPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<"stats" | "records" | "probs">("stats");
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
        {(["stats", "records", "probs"] as const).map((t) => (
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
                  <p className="font-semibold truncate">{r.name}</p>
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
