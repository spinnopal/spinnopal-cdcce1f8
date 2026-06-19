import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { SpinWheel } from "@/components/SpinWheel";
import type { Prize } from "@/lib/spin-store";
import { usePrizesBySlug } from "@/lib/prizes-hook";
import { consumeAccessCode, recordPrizeForCode } from "@/lib/access-codes.functions";
import { pickWinnerForSlug } from "@/lib/prizes.functions";
import { playClick } from "@/lib/sounds";

const search = z.object({
  code: z.string().min(1).max(64),
  name: z.string().min(1).max(40).optional(),
});

export const Route = createFileRoute("/s/$slug/spin")({
  validateSearch: search,
  head: ({ params }) => ({ meta: [{ title: `Spin — ${params.slug}` }] }),
  component: SpinPage,
});

function SpinPage() {
  const { slug } = Route.useParams();
  const { code, name } = Route.useSearch();
  const navigate = useNavigate();
  const { prizes, isLoading } = usePrizesBySlug(slug);
  const consume = useServerFn(consumeAccessCode);
  const pickWinner = useServerFn(pickWinnerForSlug);
  const record = useServerFn(recordPrizeForCode);
  const [spinning, setSpinning] = useState(false);
  const [target, setTarget] = useState<number | null>(null);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const handleSpin = async () => {
    if (spinning || done || prizes.length === 0) return;
    playClick();
    setError("");
    setSpinning(true);
    try {
      const res = await consume({ data: { slug, code } });
      if (!res.ok) { setSpinning(false); setError("This code is invalid or has already been used."); return; }
    } catch { setSpinning(false); setError("Could not verify your code. Please try again."); return; }

    let winnerId: string;
    try {
      const w = await pickWinner({ data: { slug } });
      winnerId = w.id;
    } catch { setSpinning(false); setError("Could not pick a prize. Please try again."); return; }

    const idx = prizes.findIndex((p) => p.id === winnerId);
    setTarget(idx >= 0 ? idx : 0);
  };

  const handleComplete = (prize: Prize) => {
    setDone(true);
    record({ data: { slug, code, prize: prize.name.slice(0, 100), name: name?.trim() || undefined } }).catch(() => {});
    setTimeout(() => {
      navigate({ to: "/s/$slug/result", params: { slug }, search: { code, pid: prize.id } });
    }, 600);
  };

  return (
    <div className="min-h-screen flex flex-col items-center px-4 py-6">
      <div className="w-full flex items-center justify-between mb-2">
        <button onClick={() => { playClick(); navigate({ to: "/s/$slug", params: { slug } }); }} className="text-sm text-muted-foreground">← Back</button>
        <p className="text-xs uppercase tracking-widest text-gold">Lucky Spin</p>
        <span className="w-10" />
      </div>

      <p className="text-center text-muted-foreground text-sm mb-3">
        {name ? <><span className="text-foreground font-semibold">{name}</span> · </> : null}
        Code <span className="text-foreground font-mono font-semibold tracking-widest">{code}</span>
      </p>

      <div className="w-[96vw] max-w-[560px] mt-2">
        {isLoading || prizes.length === 0 ? (
          <div className="aspect-square flex items-center justify-center text-muted-foreground">Loading wheel…</div>
        ) : (
          <SpinWheel prizes={prizes} spinning={spinning} targetIndex={target} onComplete={handleComplete} />
        )}
      </div>

      {error && <p className="mt-4 text-destructive text-sm text-center">{error}</p>}

      <button
        onClick={handleSpin}
        disabled={spinning || done || isLoading || prizes.length === 0}
        className="mt-10 w-full max-w-sm gradient-primary text-[#0F1115] font-black text-xl tracking-widest py-5 rounded-2xl glow-orange active:scale-[0.98] transition disabled:opacity-60"
      >
        {spinning ? "SPINNING..." : "SPIN NOW"}
      </button>
    </div>
  );
}
