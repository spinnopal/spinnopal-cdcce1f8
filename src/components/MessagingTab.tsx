import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listSpinRecords } from "@/lib/access-codes.functions";
import { sendBulkEmail, sendBulkWhatsApp } from "@/lib/messaging.functions";

type RecordRow = {
  code: string;
  spun_at: string | null;
  prize_won: string | null;
  customer_name: string | null;
  customer_contact: string | null;
  customer_email: string | null;
};

type Channel = "wa-link" | "wa-api" | "email";

export function MessagingTab({ shop }: { shop: { id: string; name: string } }) {
  const fetchRecords = useServerFn(listSpinRecords);
  const doEmail = useServerFn(sendBulkEmail);
  const doWa = useServerFn(sendBulkWhatsApp);

  const [rows, setRows] = useState<RecordRow[]>([]);
  const [channel, setChannel] = useState<Channel>("wa-link");
  const [outcome, setOutcome] = useState<"all" | "won" | "lost">("all");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("Hi {{name}}, thanks for spinning at " + shop.name + "! You won: {{prize}}.");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string>("");

  const load = useCallback(async () => {
    const r = await fetchRecords({ data: { shopId: shop.id } });
    setRows((r.rows as RecordRow[]) ?? []);
  }, [fetchRecords, shop.id]);
  useEffect(() => { load(); }, [load]);

  // Win is defined as a prize that isn't "try again". We approximate via prize name.
  const isWin = (r: RecordRow) =>
    !!r.prize_won && !/try\s*again|better\s*luck/i.test(r.prize_won);

  const filtered = useMemo(() => {
    const fromTs = from ? new Date(from + "T00:00:00").getTime() : null;
    const toTs = to ? new Date(to + "T23:59:59").getTime() : null;
    return rows.filter((r) => {
      if (outcome === "won" && !isWin(r)) return false;
      if (outcome === "lost" && isWin(r)) return false;
      if (fromTs && r.spun_at && new Date(r.spun_at).getTime() < fromTs) return false;
      if (toTs && r.spun_at && new Date(r.spun_at).getTime() > toTs) return false;
      // recipient must have the channel's required field
      if (channel === "email" && !r.customer_email) return false;
      if ((channel === "wa-link" || channel === "wa-api") && !r.customer_contact) return false;
      return true;
    });
  }, [rows, outcome, from, to, channel]);

  // Reset selection when filter changes — default to all visible.
  useEffect(() => {
    setSelected(new Set(filtered.map((r) => r.code)));
  }, [filtered]);

  const toggle = (code: string) => {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(code)) n.delete(code); else n.add(code);
      return n;
    });
  };
  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((r) => r.code)));
  };

  const chosen = filtered.filter((r) => selected.has(r.code));

  const personalize = (text: string, r: RecordRow) =>
    text
      .replaceAll("{{name}}", r.customer_name || "")
      .replaceAll("{{prize}}", r.prize_won || "");

  const openWhatsAppLinks = () => {
    if (chosen.length === 0) return;
    if (chosen.length > 5 && !confirm(`Open ${chosen.length} WhatsApp chats one after another?`)) return;
    setStatus(`Opening ${chosen.length} chats…`);
    chosen.forEach((r, i) => {
      const phone = (r.customer_contact || "").replace(/[^\d+]/g, "").replace(/^\+/, "");
      if (!phone) return;
      const text = encodeURIComponent(personalize(body, r));
      const url = `https://wa.me/${phone}?text=${text}`;
      // Stagger opens slightly so popup blockers don't swallow them all.
      setTimeout(() => window.open(url, "_blank", "noopener"), i * 250);
    });
    setTimeout(() => setStatus(""), 2000);
  };

  const sendWhatsAppApi = async () => {
    if (chosen.length === 0) return;
    setBusy(true); setStatus("");
    try {
      const res = await doWa({
        data: {
          shopId: shop.id,
          body,
          recipients: chosen.map((r) => ({
            name: r.customer_name,
            contact: r.customer_contact!,
            prize: r.prize_won,
          })),
        },
      });
      if (!res.ok) setStatus(res.message || "WhatsApp API not configured");
      else setStatus(`Sent to ${res.sent} of ${res.total}.`);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Failed");
    } finally { setBusy(false); }
  };

  const sendEmail = async () => {
    if (chosen.length === 0) return;
    if (!subject.trim()) { setStatus("Subject is required."); return; }
    setBusy(true); setStatus("");
    try {
      const res = await doEmail({
        data: {
          shopId: shop.id,
          subject,
          body,
          recipients: chosen.map((r) => ({
            name: r.customer_name,
            email: r.customer_email!,
            prize: r.prize_won,
          })),
        },
      });
      if (!res.ok) setStatus(res.message || "Email not configured");
      else setStatus(`Queued ${res.sent} of ${res.total}.`);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Failed");
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      <div className="glass rounded-2xl p-4 space-y-3">
        <p className="text-xs uppercase tracking-widest text-gold">Channel</p>
        <div className="grid grid-cols-3 gap-1 text-xs">
          {([
            ["wa-link", "WhatsApp link"],
            ["wa-api", "WhatsApp API"],
            ["email", "Email"],
          ] as const).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setChannel(k)}
              className={`px-2 py-2 rounded-lg ${channel === k ? "bg-primary text-[#0F1115] font-bold" : "bg-white/5"}`}
            >
              {label}
            </button>
          ))}
        </div>
        {channel === "wa-link" && (
          <p className="text-[11px] text-muted-foreground">
            Opens a pre-filled WhatsApp chat per customer. You tap send in each chat. No setup, works for any size shop.
          </p>
        )}
        {channel === "wa-api" && (
          <p className="text-[11px] text-muted-foreground">
            Sends automatically through the WhatsApp Business Cloud API. Needs Meta credentials configured.
          </p>
        )}
        {channel === "email" && (
          <p className="text-[11px] text-muted-foreground">
            Sends from your verified email domain. Needs an email domain set up.
          </p>
        )}
      </div>

      <div className="glass rounded-2xl p-4 space-y-3">
        <p className="text-xs uppercase tracking-widest text-gold">Filter recipients</p>
        <div className="flex gap-1 text-xs">
          {(["all", "won", "lost"] as const).map((o) => (
            <button key={o} onClick={() => setOutcome(o)}
              className={`px-2 py-1 rounded capitalize ${outcome === o ? "bg-primary text-[#0F1115] font-bold" : "bg-white/5"}`}>
              {o}
            </button>
          ))}
        </div>
        <div className="flex gap-2 text-xs">
          <label className="flex-1">From
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
              className="w-full mt-1 bg-[#0F1115]/70 border border-white/10 rounded-lg px-2 py-2 outline-none" />
          </label>
          <label className="flex-1">To
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
              className="w-full mt-1 bg-[#0F1115]/70 border border-white/10 rounded-lg px-2 py-2 outline-none" />
          </label>
        </div>
      </div>

      <div className="glass rounded-2xl p-4 space-y-2">
        <p className="text-xs uppercase tracking-widest text-gold">Message</p>
        {channel === "email" && (
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject"
            maxLength={200}
            className="w-full bg-[#0F1115]/70 border border-white/10 rounded-lg px-3 py-2 outline-none"
          />
        )}
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={5}
          maxLength={4000}
          className="w-full bg-[#0F1115]/70 border border-white/10 rounded-lg px-3 py-2 outline-none resize-none"
        />
        <p className="text-[11px] text-muted-foreground">
          You can use <span className="font-mono">{"{{name}}"}</span> and <span className="font-mono">{"{{prize}}"}</span> — they'll be replaced per customer.
        </p>
      </div>

      <div className="glass rounded-2xl p-4 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-widest text-gold">Recipients ({chosen.length}/{filtered.length})</p>
          <button onClick={toggleAll} className="text-xs px-2 py-1 rounded bg-white/5">
            {selected.size === filtered.length ? "Clear all" : "Select all"}
          </button>
        </div>
        <div className="space-y-1 max-h-[40vh] overflow-y-auto">
          {filtered.map((r) => (
            <label key={r.code} className="flex items-center gap-2 text-sm px-2 py-1 rounded hover:bg-white/5 cursor-pointer">
              <input
                type="checkbox"
                checked={selected.has(r.code)}
                onChange={() => toggle(r.code)}
              />
              <span className="flex-1 min-w-0 truncate">
                <span className="font-semibold">{r.customer_name || "—"}</span>
                <span className="text-muted-foreground"> · {channel === "email" ? r.customer_email : r.customer_contact}</span>
              </span>
              <span className="text-[11px] text-gold truncate max-w-[40%]">{r.prize_won}</span>
            </label>
          ))}
          {filtered.length === 0 && (
            <p className="text-sm text-muted-foreground py-6 text-center">
              No customers match — try adjusting filters, or ensure they provided a {channel === "email" ? "email" : "contact number"}.
            </p>
          )}
        </div>
      </div>

      {status && <p className="text-sm text-center">{status}</p>}

      <div className="sticky bottom-2 z-10">
        {channel === "wa-link" && (
          <button
            onClick={openWhatsAppLinks}
            disabled={chosen.length === 0}
            className="w-full gradient-primary text-[#0F1115] font-bold py-3 rounded-xl disabled:opacity-60"
          >
            Open {chosen.length} WhatsApp chats
          </button>
        )}
        {channel === "wa-api" && (
          <button
            onClick={sendWhatsAppApi}
            disabled={chosen.length === 0 || busy}
            className="w-full gradient-primary text-[#0F1115] font-bold py-3 rounded-xl disabled:opacity-60"
          >
            {busy ? "Sending…" : `Send WhatsApp to ${chosen.length}`}
          </button>
        )}
        {channel === "email" && (
          <button
            onClick={sendEmail}
            disabled={chosen.length === 0 || busy}
            className="w-full gradient-primary text-[#0F1115] font-bold py-3 rounded-xl disabled:opacity-60"
          >
            {busy ? "Sending…" : `Email ${chosen.length} customers`}
          </button>
        )}
      </div>
    </div>
  );
}
