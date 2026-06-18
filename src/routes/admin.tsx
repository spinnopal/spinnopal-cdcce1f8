import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  type Prize,
} from "@/lib/spin-store";
import { usePrizes, useInvalidatePrizes } from "@/lib/prizes-hook";
import { upsertPrize, deletePrize, updateProbabilities } from "@/lib/prizes.functions";
import {
  deleteUnusedCodes,
  generateAccessCodes,
  listAccessCodes,
  listSpinRecords,
  deleteSpinRecord,
  resetSpinRecords,
} from "@/lib/access-codes.functions";
import { playClick } from "@/lib/sounds";


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



type SpinRecord = {
  code: string;
  spun_at: string | null;
  prize_won: string | null;
  customer_name: string | null;
};

function AdminPage() {
  const navigate = useNavigate();
  const { prizes } = usePrizes();
  const verifyList = useServerFn(listAccessCodes);
  const fetchRecords = useServerFn(listSpinRecords);
  const delRecord = useServerFn(deleteSpinRecord);
  const resetAllRecords = useServerFn(resetSpinRecords);
  const [password, setPassword] = useState(() => (typeof sessionStorage !== "undefined" ? sessionStorage.getItem("mmz_admin_pw") || "" : ""));
  const [authed, setAuthed] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [tab, setTab] = useState<"stats" | "records" | "prizes" | "codes">("codes");
  const [query, setQuery] = useState("");
  const [records, setRecords] = useState<SpinRecord[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(false);

  const tryAuth = async (pw: string) => {
    setAuthLoading(true); setAuthError("");
    try {
      await verifyList({ data: { password: pw } });
      sessionStorage.setItem("mmz_admin_pw", pw);
      setAuthed(true);
    } catch {
      setAuthError("Incorrect password.");
      setAuthed(false);
    } finally {
      setAuthLoading(false);
    }
  };

  const loadRecords = useCallback(async () => {
    const pw = sessionStorage.getItem("mmz_admin_pw") || "";
    if (!pw) return;
    setRecordsLoading(true);
    try {
      const res = await fetchRecords({ data: { password: pw } });
      setRecords((res.rows as SpinRecord[]) ?? []);
    } catch {
      // ignore
    } finally {
      setRecordsLoading(false);
    }
  }, [fetchRecords]);

  useEffect(() => {
    if (password && !authed) tryAuth(password);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (authed && (tab === "records" || tab === "stats")) loadRecords();
  }, [authed, tab, loadRecords]);

  const filtered = records.filter((r) => {
    const q = query.toLowerCase();
    return (
      (r.customer_name || "").toLowerCase().includes(q) ||
      (r.prize_won || "").toLowerCase().includes(q) ||
      r.code.toLowerCase().includes(q)
    );
  });

  const stats = useMemo(() => {
    const total = records.length;
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const today = records.filter((r) => r.spun_at && new Date(r.spun_at).getTime() >= todayStart.getTime()).length;
    const dist: Record<string, number> = {};
    for (const r of records) {
      const k = r.prize_won || "Unknown";
      dist[k] = (dist[k] || 0) + 1;
    }
    const tryAgainNames = new Set(prizes.filter((p) => !p.isWin).map((p) => p.name));
    const winners = records.filter((r) => r.prize_won && !tryAgainNames.has(r.prize_won)).length;
    const most = Object.entries(dist).sort((a, b) => b[1] - a[1])[0];
    return { total, winners, today, dist, most };
  }, [records, prizes]);

  const handleExport = () => {
    const rows = [["Name", "Code", "Prize", "Date", "Time"]];
    for (const r of records) {
      const d = r.spun_at ? new Date(r.spun_at) : null;
      rows.push([
        (r.customer_name || "").replace(/"/g, '""'),
        r.code,
        (r.prize_won || "").replace(/"/g, '""'),
        d ? d.toLocaleDateString() : "",
        d ? d.toLocaleTimeString() : "",
      ]);
    }
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mmz-records-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };


  if (!authed) {
    return (
      <div className="min-h-screen px-4 py-6 max-w-md mx-auto flex flex-col justify-center">
        <div className="glass rounded-2xl p-5 space-y-3">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Admin Login</p>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && tryAuth(password)}
            placeholder="Enter admin password"
            className="w-full bg-[#0F1115]/70 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-primary"
          />
          {authError && <p className="text-destructive text-sm">{authError}</p>}
          <button
            onClick={() => tryAuth(password)}
            disabled={authLoading || !password}
            className="w-full gradient-primary text-[#0F1115] font-bold py-3 rounded-xl disabled:opacity-60"
          >
            {authLoading ? "Checking..." : "Unlock"}
          </button>
          <button onClick={() => navigate({ to: "/" })} className="w-full text-xs text-muted-foreground mt-1">← Back</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 py-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => { playClick(); navigate({ to: "/" }); }} className="text-sm text-muted-foreground">← Home</button>
        <h1 className="text-lg font-black tracking-widest">ADMIN PANEL</h1>
        <button onClick={() => { sessionStorage.removeItem("mmz_admin_pw"); setAuthed(false); setPassword(""); }} className="text-xs text-muted-foreground">Lock</button>
      </div>

      <div className="glass rounded-2xl p-1 flex gap-1 mb-5">
        {(["codes", "prizes", "stats", "records"] as const).map((t) => (
          <button
            key={t}
            onClick={() => { playClick(); setTab(t); }}
            className={`flex-1 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider transition ${
              tab === t ? "gradient-primary text-[#0F1115]" : "text-muted-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "codes" && <CodesTab />}
      {tab === "prizes" && <PrizesTab />}

      {tab === "stats" && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Total Spins" value={stats.total} />
            <Stat label="Winners" value={stats.winners} />
            <Stat label="Today" value={stats.today} />
          </div>
          <div className="glass rounded-2xl p-4">
            <p className="text-xs uppercase tracking-widest text-muted-foreground mb-3">Prize Distribution</p>
            {prizes.map((p) => {
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

// ============== PRIZES TAB ==============

type EditPrize = {
  id: string;
  name: string;
  short: string;
  image_url: string;
  is_win: boolean;
  probability: number;
  sort_order: number;
};

function PrizesTab() {
  const { prizes } = usePrizes();
  const invalidate = useInvalidatePrizes();
  const upsert = useServerFn(upsertPrize);
  const del = useServerFn(deletePrize);
  const updateProbs = useServerFn(updateProbabilities);

  const [editing, setEditing] = useState<EditPrize | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Local probabilities draft for the slider/number inputs.
  const [draftProbs, setDraftProbs] = useState<Record<string, number>>({});
  useEffect(() => {
    const next: Record<string, number> = {};
    for (const p of prizes) next[p.id] = p.probability;
    setDraftProbs(next);
  }, [prizes]);

  const totalProb = Object.values(draftProbs).reduce((s, n) => s + (n || 0), 0);

  const saveProbs = async () => {
    setBusy(true); setError("");
    try {
      await updateProbs({
        data: {
          password: sessionStorage.getItem("mmz_admin_pw") || "",
          probs: prizes.map((p) => ({ id: p.id, probability: draftProbs[p.id] ?? 0 })),
        },
      });
      await invalidate();
    } catch {
      setError("Failed to save probabilities");
    } finally {
      setBusy(false);
    }
  };

  const saveEditing = async () => {
    if (!editing) return;
    if (!editing.id || !editing.name || !editing.short || !editing.image_url) {
      setError("All fields required");
      return;
    }
    setBusy(true); setError("");
    try {
      await upsert({ data: { password: sessionStorage.getItem("mmz_admin_pw") || "", prize: editing } });
      await invalidate();
      setEditing(null);
    } catch (e) {
      setError((e as Error).message || "Failed to save prize");
    } finally {
      setBusy(false);
    }
  };

  const removePrize = async (id: string) => {
    if (!confirm(`Delete prize "${id}"? This cannot be undone.`)) return;
    setBusy(true); setError("");
    try {
      await del({ data: { password: sessionStorage.getItem("mmz_admin_pw") || "", id } });
      await invalidate();
    } catch {
      setError("Failed to delete");
    } finally {
      setBusy(false);
    }
  };

  const newPrize = () => {
    const nextOrder = (prizes[prizes.length - 1]?.id ? Math.max(...prizes.map((p) => 0)) : 0) + (prizes.length + 1);
    setEditing({
      id: "",
      name: "",
      short: "",
      image_url: "",
      is_win: true,
      probability: 0,
      sort_order: nextOrder,
    });
  };

  return (
    <div className="space-y-4">
      {error && <p className="text-destructive text-sm">{error}</p>}

      {/* Probabilities quick editor */}
      <div className="glass rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Probabilities (live)</p>
          <span className="text-[11px] text-muted-foreground">Total weight: {totalProb}</span>
        </div>
        <p className="text-[11px] text-muted-foreground">Values are weights; they're normalized. Saving updates the live wheel within seconds for all customers.</p>
        {prizes.map((p) => {
          const v = draftProbs[p.id] ?? 0;
          const pct = totalProb > 0 ? Math.round((v / totalProb) * 100) : 0;
          return (
            <div key={p.id} className="flex items-center gap-3">
              <img src={p.image} alt="" className="w-8 h-8 rounded object-cover bg-[#0F1115]" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{p.short}</p>
                <p className="text-[10px] text-muted-foreground">{pct}% effective</p>
              </div>
              <input
                type="number"
                min={0}
                max={1000}
                value={v}
                onChange={(e) => setDraftProbs({ ...draftProbs, [p.id]: Math.max(0, Math.min(1000, Number(e.target.value) || 0)) })}
                className="w-20 bg-[#0F1115] border border-white/10 rounded-lg px-2 py-1 text-right"
              />
            </div>
          );
        })}
        <button
          onClick={saveProbs}
          disabled={busy}
          className="w-full gradient-primary text-[#0F1115] font-bold py-2 rounded-lg disabled:opacity-60"
        >
          {busy ? "Saving…" : "Save probabilities"}
        </button>
      </div>

      {/* Prize list */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Prizes on the wheel</p>
          <button onClick={newPrize} className="text-xs px-3 py-1 rounded bg-secondary">+ Add prize</button>
        </div>
        {prizes.map((p) => (
          <div key={p.id} className="glass rounded-xl p-3 flex items-center gap-3">
            <img src={p.image} alt="" className="w-12 h-12 rounded object-cover bg-[#0F1115]" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold truncate">{p.name}</p>
              <p className="text-[11px] text-muted-foreground truncate">
                id: {p.id} · prob: {p.probability} · {p.isWin ? "Win" : "Try again"}
              </p>
            </div>
            <button
              onClick={() => setEditing({
                id: p.id, name: p.name, short: p.short, image_url: p.image,
                is_win: p.isWin, probability: p.probability,
                sort_order: (prizes.findIndex((x) => x.id === p.id) + 1),
              })}
              className="text-xs px-2 py-1 rounded bg-secondary"
            >Edit</button>
            <button onClick={() => removePrize(p.id)} className="text-xs px-2 py-1 rounded text-destructive">Delete</button>
          </div>
        ))}
      </div>

      {/* Editor modal */}
      {editing && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="glass rounded-2xl p-5 w-full max-w-md space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold">{prizes.find((x) => x.id === editing.id) ? "Edit Prize" : "Add Prize"}</h3>
              <button onClick={() => setEditing(null)} className="text-muted-foreground">✕</button>
            </div>
            {editing.image_url && (
              <img src={editing.image_url} alt="" className="w-24 h-24 rounded-xl object-cover mx-auto bg-[#0F1115]" />
            )}
            <Field label="ID (lowercase, no spaces)">
              <input
                disabled={!!prizes.find((x) => x.id === editing.id)}
                value={editing.id}
                onChange={(e) => setEditing({ ...editing, id: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })}
                className="w-full bg-[#0F1115] border border-white/10 rounded-lg px-3 py-2 disabled:opacity-60"
              />
            </Field>
            <Field label="Full name">
              <input
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                className="w-full bg-[#0F1115] border border-white/10 rounded-lg px-3 py-2"
              />
            </Field>
            <Field label="Short label (shown on wheel)">
              <input
                value={editing.short}
                onChange={(e) => setEditing({ ...editing, short: e.target.value })}
                className="w-full bg-[#0F1115] border border-white/10 rounded-lg px-3 py-2"
              />
            </Field>
            <Field label="Image">
              <div className="space-y-2">
                <label className="block">
                  <span className="sr-only">Upload image</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (file.size > 10_000_000) {
                        setError("Image too large (max 10 MB).");
                        return;
                      }
                      const readAsDataUrl = (f: Blob) => new Promise<string>((resolve, reject) => {
                        const r = new FileReader();
                        r.onload = () => resolve(r.result as string);
                        r.onerror = () => reject(r.error);
                        r.readAsDataURL(f);
                      });
                      const original = await readAsDataUrl(file);
                      let dataUrl = original;
                      // Auto-downscale to keep DB payload small (max 1024px, JPEG ~0.88)
                      if (file.type !== "image/svg+xml" && file.type !== "image/gif") {
                        try {
                          const img = await new Promise<HTMLImageElement>((res, rej) => {
                            const i = new Image();
                            i.onload = () => res(i);
                            i.onerror = () => rej(new Error("decode failed"));
                            i.src = original;
                          });
                          const MAX = 1024;
                          const scale = Math.min(1, MAX / Math.max(img.width, img.height));
                          const w = Math.round(img.width * scale);
                          const h = Math.round(img.height * scale);
                          const canvas = document.createElement("canvas");
                          canvas.width = w; canvas.height = h;
                          const ctx = canvas.getContext("2d");
                          if (ctx) {
                            ctx.drawImage(img, 0, 0, w, h);
                            const hasAlpha = file.type === "image/png" || file.type === "image/webp";
                            dataUrl = canvas.toDataURL(hasAlpha ? "image/png" : "image/jpeg", 0.88);
                            if (dataUrl.length > 3_500_000 && !hasAlpha) {
                              dataUrl = canvas.toDataURL("image/jpeg", 0.78);
                            }
                          }
                        } catch { /* fall back to original */ }
                      }
                      if (dataUrl.length > 8_000_000) {
                        setError("Processed image is still too large. Try a smaller photo.");
                        return;
                      }
                      setError("");
                      setEditing((prev) => prev ? { ...prev, image_url: dataUrl } : prev);
                    }}
                    className="block w-full text-xs text-muted-foreground file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-secondary file:text-foreground file:font-semibold"
                  />
                </label>
                <p className="text-[10px] text-muted-foreground">Upload a PNG/JPG up to 10 MB — it will be auto-optimized for the wheel. Or paste a URL below.</p>
                <input
                  value={editing.image_url.startsWith("data:") ? "" : editing.image_url}
                  onChange={(e) => setEditing({ ...editing, image_url: e.target.value })}
                  placeholder="https://… (optional)"
                  className="w-full bg-[#0F1115] border border-white/10 rounded-lg px-3 py-2 text-xs font-mono"
                />
              </div>
            </Field>
            <div className="grid grid-cols-3 gap-2">
              <Field label="Probability">
                <input type="number" min={0} max={1000}
                  value={editing.probability}
                  onChange={(e) => setEditing({ ...editing, probability: Math.max(0, Math.min(1000, Number(e.target.value) || 0)) })}
                  className="w-full bg-[#0F1115] border border-white/10 rounded-lg px-3 py-2 text-right"
                />
              </Field>
              <Field label="Sort order">
                <input type="number" min={0} max={1000}
                  value={editing.sort_order}
                  onChange={(e) => setEditing({ ...editing, sort_order: Math.max(0, Math.min(1000, Number(e.target.value) || 0)) })}
                  className="w-full bg-[#0F1115] border border-white/10 rounded-lg px-3 py-2 text-right"
                />
              </Field>
              <Field label="Type">
                <button
                  type="button"
                  onClick={() => setEditing({ ...editing, is_win: !editing.is_win })}
                  className={`w-full py-2 rounded-lg text-xs font-bold ${editing.is_win ? "bg-emerald-600 text-white" : "bg-secondary text-muted-foreground"}`}
                >
                  {editing.is_win ? "Win" : "Try again"}
                </button>
              </Field>
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setEditing(null)} className="flex-1 py-2 rounded-lg bg-secondary">Cancel</button>
              <button
                onClick={saveEditing}
                disabled={busy}
                className="flex-1 gradient-primary text-[#0F1115] font-bold py-2 rounded-lg disabled:opacity-60"
              >
                {busy ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

// Unused Prize type guard to keep tree-shake quiet
export type _PrizeType = Prize;

// ============== CODES TAB (unchanged) ==============

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
    setLoading(true); setError("");
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
    setLoading(true); setError("");
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
