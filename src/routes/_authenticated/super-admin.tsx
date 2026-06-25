import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  listAllShops,
  setShopActive,
  deleteShop,
  claimShop,
  sendOwnerPasswordReset,
  forceSetOwnerPassword,
  signOutOwner,
  getShopDetails,
  updateShopSubscription,
  extendShopPeriod,
  recordShopPayment,
} from "@/lib/shops.functions";


export const Route = createFileRoute("/_authenticated/super-admin")({
  head: () => ({ meta: [{ title: "Super admin — Lucky Spin" }] }),
  component: SuperAdminPage,
});

type EnrichedShop = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  is_active: boolean;
  created_at: string;
  owner_user_id: string | null;
  owner_email: string | null;
  owner_last_sign_in_at: string | null;
  owner_email_confirmed_at: string | null;
  codes_count: number;
  spins_count: number;
  plan: "free" | "pro" | "lifetime";
  subscription_status: "trial" | "active" | "past_due" | "suspended";
  trial_ends_at: string | null;
  current_period_end: string | null;
};


type ShopDetails = Awaited<ReturnType<typeof getShopDetails>>;

function fmt(d: string | null | undefined) {
  return d ? new Date(d).toLocaleString() : "—";
}

function SuperAdminPage() {
  const fetchAll = useServerFn(listAllShops);
  const doSetActive = useServerFn(setShopActive);
  const doDelete = useServerFn(deleteShop);
  const doClaim = useServerFn(claimShop);
  const doReset = useServerFn(sendOwnerPasswordReset);
  const doForcePw = useServerFn(forceSetOwnerPassword);
  const doSignOut = useServerFn(signOutOwner);
  const fetchDetails = useServerFn(getShopDetails);
  const doUpdateSub = useServerFn(updateShopSubscription);
  const doExtend = useServerFn(extendShopPeriod);
  const doRecordPayment = useServerFn(recordShopPayment);


  const [shops, setShops] = useState<EnrichedShop[]>([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [details, setDetails] = useState<ShopDetails | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState("");

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

  const openDetails = async (id: string) => {
    setOpenId(id);
    setDetails(null);
    setDetailsLoading(true);
    try {
      const d = await fetchDetails({ data: { shopId: id } });
      setDetails(d);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed to load");
    } finally { setDetailsLoading(false); }
  };

  const run = async (key: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(key); setMsg("");
    try { await fn(); setMsg(ok); }
    catch (e) { setMsg(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(null); }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;
  if (err) return <div className="min-h-screen flex items-center justify-center text-destructive">{err}</div>;

  return (
    <div className="min-h-screen px-4 py-5 max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-gold">Super admin</p>
          <h1 className="text-2xl font-black">All shops ({shops.length})</h1>
        </div>
        <Link to="/dashboard" className="text-sm px-3 py-2 rounded-lg bg-white/5">← Back</Link>
      </div>

      {msg && <div className="mb-3 text-xs px-3 py-2 rounded bg-white/5">{msg}</div>}

      <div className="space-y-2">
        {shops.map((s) => (
          <div key={s.id} className="glass rounded-xl p-4">
            <div className="flex justify-between items-start gap-3 flex-wrap">
              <div className="flex gap-3 items-start min-w-0">
                {s.logo_url ? (
                  <img src={s.logo_url} alt="" className="w-12 h-12 rounded-lg object-cover bg-white/5" />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-white/5 grid place-items-center text-xs text-muted-foreground">no logo</div>
                )}
                <div className="min-w-0">
                  <p className="font-bold truncate">
                    {s.name}{" "}
                    <a href={`/s/${s.slug}`} target="_blank" rel="noreferrer" className="text-xs text-primary font-mono">/s/{s.slug} ↗</a>
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {s.owner_email || (s.owner_user_id ? "Owner (no email)" : "Unclaimed")}
                    {s.owner_email_confirmed_at ? <span className="ml-1 text-emerald-400">✓ verified</span> : s.owner_user_id ? <span className="ml-1 text-amber-400">unverified</span> : null}
                  </p>
                  <p className="text-xs mt-1">
                    Last sign-in: {fmt(s.owner_last_sign_in_at)} · created {new Date(s.created_at).toLocaleDateString()}
                  </p>
                  <p className="text-xs mt-1">
                    {s.codes_count} codes · {s.spins_count} spins ·{" "}
                    {s.is_active ? <span className="text-emerald-400">active</span> : <span className="text-destructive">suspended</span>}
                  </p>
                  <p className="text-xs mt-1">
                    <span className="px-1.5 py-0.5 rounded bg-white/10 uppercase font-bold mr-1">{s.plan}</span>
                    <span className={
                      s.subscription_status === "active" ? "text-emerald-400" :
                      s.subscription_status === "trial" ? "text-amber-300" :
                      s.subscription_status === "past_due" ? "text-orange-400" : "text-destructive"
                    }>{s.subscription_status}</span>
                    {s.current_period_end && <span className="text-muted-foreground"> · renews {new Date(s.current_period_end).toLocaleDateString()}</span>}
                    {!s.current_period_end && s.trial_ends_at && s.subscription_status === "trial" && (
                      <span className="text-muted-foreground"> · trial ends {new Date(s.trial_ends_at).toLocaleDateString()}</span>
                    )}
                  </p>

                </div>
              </div>
              <div className="flex gap-1 flex-wrap text-xs">
                <button onClick={() => openDetails(s.id)} className="px-2 py-1 rounded bg-primary text-[#0F1115] font-bold">View details</button>
                {!s.owner_user_id && <button onClick={async () => { await doClaim({ data: { id: s.id } }); load(); }} className="px-2 py-1 rounded bg-primary text-[#0F1115] font-bold">Claim</button>}
                <button onClick={async () => { await doSetActive({ data: { id: s.id, is_active: !s.is_active } }); load(); }} className="px-2 py-1 rounded bg-white/5">
                  {s.is_active ? "Suspend" : "Reactivate"}
                </button>
                <button onClick={async () => { if (confirm(`Delete shop "${s.name}" and all its data?`)) { await doDelete({ data: { id: s.id } }); load(); } }} className="px-2 py-1 rounded bg-destructive/20 text-destructive">Delete</button>
              </div>
            </div>

            {s.owner_user_id && (
              <div className="mt-3 pt-3 border-t border-white/10 flex gap-1 flex-wrap text-xs">
                <button
                  disabled={busy === `r${s.id}`}
                  onClick={() => run(`r${s.id}`,
                    () => doReset({ data: { shopId: s.id, redirectTo: `${window.location.origin}/auth` } }),
                    `Reset email sent to ${s.owner_email}`)}
                  className="px-2 py-1 rounded bg-white/5"
                >
                  {busy === `r${s.id}` ? "…" : "Send reset email"}
                </button>
                <button
                  disabled={busy === `p${s.id}`}
                  onClick={() => {
                    const pw = prompt(`Set a new password for ${s.owner_email}\n(min 8 chars, will sign them out everywhere)`);
                    if (!pw) return;
                    run(`p${s.id}`, () => doForcePw({ data: { shopId: s.id, password: pw } }), "Password updated. Owner signed out everywhere.");
                  }}
                  className="px-2 py-1 rounded bg-amber-500/20 text-amber-300"
                >
                  {busy === `p${s.id}` ? "…" : "Force-set password"}
                </button>
                <button
                  disabled={busy === `o${s.id}`}
                  onClick={() => {
                    if (!confirm("Sign this owner out of all devices?")) return;
                    run(`o${s.id}`, () => doSignOut({ data: { shopId: s.id } }), "Owner signed out everywhere.");
                  }}
                  className="px-2 py-1 rounded bg-white/5"
                >
                  {busy === `o${s.id}` ? "…" : "Sign out all devices"}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {openId && (
        <div className="fixed inset-0 z-50 bg-black/70 grid place-items-center p-3" onClick={() => setOpenId(null)}>
          <div className="bg-[#0F1115] border border-white/10 rounded-2xl w-full max-w-3xl max-h-[88vh] overflow-auto p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-lg font-bold">Shop details</h2>
              <button onClick={() => setOpenId(null)} className="text-sm px-2 py-1 rounded bg-white/5">Close</button>
            </div>
            {detailsLoading || !details ? (
              <p className="text-muted-foreground">Loading…</p>
            ) : (
              <div className="space-y-5 text-sm">
                <section>
                  <div className="flex gap-3 items-center">
                    {details.shop.logo_url ? (
                      <img src={details.shop.logo_url} className="w-16 h-16 rounded-lg object-cover" alt="" />
                    ) : <div className="w-16 h-16 rounded-lg bg-white/5" />}
                    <div>
                      <p className="font-bold text-base">{details.shop.name}</p>
                      <a href={`/s/${details.shop.slug}`} target="_blank" rel="noreferrer" className="text-primary text-xs font-mono">/s/{details.shop.slug} ↗</a>
                    </div>
                  </div>
                </section>

                <section>
                  <h3 className="font-bold mb-2">Owner</h3>
                  {details.owner ? (
                    <ul className="text-xs space-y-1 text-muted-foreground">
                      <li>Email: <span className="text-foreground">{details.owner.email ?? "—"}</span></li>
                      <li>Email confirmed: <span className="text-foreground">{fmt(details.owner.email_confirmed_at)}</span></li>
                      <li>Last sign-in: <span className="text-foreground">{fmt(details.owner.last_sign_in_at)}</span></li>
                      <li>Account created: <span className="text-foreground">{fmt(details.owner.created_at)}</span></li>
                    </ul>
                  ) : <p className="text-xs text-muted-foreground">Unclaimed shop.</p>}
                  <p className="text-[11px] text-muted-foreground mt-2">Passwords are stored as one-way hashes and cannot be viewed. Use the actions on the row to send a reset email or force-set a new password.</p>
                </section>

                <SubscriptionSection
                  shop={details.shop as any}
                  payments={(details as any).payments ?? []}
                  busy={busy}
                  onUpdate={async (patch) => {
                    await run(`sub${details.shop.id}`, () => doUpdateSub({ data: { shopId: details.shop.id, ...patch } }), "Subscription updated");
                    const d = await fetchDetails({ data: { shopId: details.shop.id } });
                    setDetails(d); load();
                  }}
                  onExtend={async (months) => {
                    await run(`ext${details.shop.id}`, () => doExtend({ data: { shopId: details.shop.id, months } }), `Extended by ${months} month(s)`);
                    const d = await fetchDetails({ data: { shopId: details.shop.id } });
                    setDetails(d); load();
                  }}
                  onRecordPayment={async (p) => {
                    await run(`pay${details.shop.id}`, () => doRecordPayment({ data: { shopId: details.shop.id, ...p } }), "Payment recorded");
                    const d = await fetchDetails({ data: { shopId: details.shop.id } });
                    setDetails(d); load();
                  }}
                />



                <section>
                  <h3 className="font-bold mb-2">Prizes ({details.prizes.length})</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {details.prizes.map((p) => (
                      <div key={p.id} className="rounded-lg bg-white/5 p-2 text-xs">
                        <div className="flex items-center gap-2">
                          {p.image_url ? <img src={p.image_url} alt="" className="w-8 h-8 rounded object-cover" /> : <div className="w-8 h-8 rounded bg-white/10" />}
                          <div className="min-w-0">
                            <p className="font-bold truncate">{p.name}</p>
                            <p className="text-muted-foreground">{p.is_win ? "win" : "lose"} · p={p.probability}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <section>
                  <h3 className="font-bold mb-2">Recent spins ({details.spins.length})</h3>
                  <div className="max-h-56 overflow-auto rounded-lg border border-white/10">
                    <table className="w-full text-xs">
                      <thead className="bg-white/5 text-left">
                        <tr><th className="p-2">When</th><th className="p-2">Customer</th><th className="p-2">Contact</th><th className="p-2">Email</th><th className="p-2">Code</th><th className="p-2">Prize</th></tr>
                      </thead>
                      <tbody>
                        {details.spins.map((s) => (
                          <tr key={s.code} className="border-t border-white/5">
                            <td className="p-2 whitespace-nowrap">{fmt(s.spun_at)}</td>
                            <td className="p-2">{s.customer_name ?? "—"}</td>
                            <td className="p-2">{s.customer_contact ?? "—"}</td>
                            <td className="p-2">{s.customer_email ?? "—"}</td>
                            <td className="p-2 font-mono">{s.code}</td>
                            <td className="p-2">{s.prize_won ?? "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>

                <section>
                  <h3 className="font-bold mb-2">Access codes ({details.codes.length})</h3>
                  <div className="max-h-56 overflow-auto rounded-lg border border-white/10">
                    <table className="w-full text-xs">
                      <thead className="bg-white/5 text-left">
                        <tr><th className="p-2">Code</th><th className="p-2">Used</th><th className="p-2">Customer</th><th className="p-2">Contact</th><th className="p-2">Email</th><th className="p-2">Prize</th><th className="p-2">Created</th></tr>
                      </thead>
                      <tbody>
                        {details.codes.map((c) => (
                          <tr key={c.code} className="border-t border-white/5">
                            <td className="p-2 font-mono">{c.code}</td>
                            <td className="p-2">{c.is_used ? <span className="text-emerald-400">yes</span> : <span className="text-muted-foreground">no</span>}</td>
                            <td className="p-2">{c.customer_name ?? "—"}</td>
                            <td className="p-2">{c.customer_contact ?? "—"}</td>
                            <td className="p-2">{c.customer_email ?? "—"}</td>
                            <td className="p-2">{c.prize_won ?? "—"}</td>
                            <td className="p-2 whitespace-nowrap">{new Date(c.created_at).toLocaleDateString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
