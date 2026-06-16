import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { SpinWheel } from "@/components/SpinWheel";
import { saveRecord, type Prize } from "@/lib/spin-store";
import { usePrizes } from "@/lib/prizes-hook";
import { consumeAccessCode, recordPrizeForCode } from "@/lib/access-codes.functions";
import { pickWinnerServer } from "@/lib/prizes.functions";
import { playClick } from "@/lib/sounds";
import { z } from "zod";

const search = z.object({
  code: z.string().min(1).max(64),
  name: z.string().min(1).max(40).optional(),
});

export const Route = createFileRoute("/spin")({
  validateSearch: search,
  head: () => ({ meta: [{ title: "Spin — Mas Mobile Zone" }] }),
  component: SpinPage,
});

function SpinPage() {
  const { code, name } = Route.useSearch();
  const navigate = useNavigate();
  const { prizes, isLoading } = usePrizes();
  const consume = useServerFn(consumeAccessCode);
  const pickWinner = useServerFn(pickWinnerServer);
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
      const res = await consume({ data: { code } });
      if (!res.ok) {
        setSpinning(false);
        setError("This code is invalid or has already been used.");
        return;
      }
    } catch {
      setSpinning(false);
      setError("Could not verify your code. Please try again.");
      return;
    }
    let winnerId: string;
    try {
      const w = await pickWinner();
      winnerId = w.id;
    } catch {
      setSpinning(false);
      setError("Could not pick a prize. Please try again.");
      return;
    }
    const idx = prizes.findIndex((p) => p.id === winnerId);
    setTarget(idx >= 0 ? idx : 0);
  };

  const handleComplete = (prize: Prize) => {
    setDone(true);
    const who = name?.trim() || code;
    saveRecord({ name: who, prizeId: prize.id, prizeName: prize.name, isWin: prize.isWin });
    const tag = name?.trim() ? `${name.trim()} — ${prize.name}` : prize.name;
    record({ data: { code, prize: tag.slice(0, 100) } }).catch(() => {});
    setTimeout(() => {
      navigate({ to: "/result", search: { code, pid: prize.id } });
    }, 600);
  };

  return (
    <div className="min-h-screen flex flex-col items-center px-4 py-6">
      <div className="w-full flex items-center justify-between mb-2">
        <button onClick={() => { playClick(); navigate({ to: "/" }); }} className="text-sm text-muted-foreground">← Back</button>
        <p className="text-xs uppercase tracking-widest text-gold">Lucky Spin</p>
        <span className="w-10" />
      </div>

      <p className="text-center text-muted-foreground text-sm mb-3">
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
