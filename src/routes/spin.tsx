import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { SpinWheel } from "@/components/SpinWheel";
import { PRIZES, pickWinner, saveRecord, type Prize } from "@/lib/spin-store";
import { consumeAccessCode, recordPrizeForCode } from "@/lib/access-codes.functions";
import { z } from "zod";

const search = z.object({
  code: z.string().min(1).max(64),
});

export const Route = createFileRoute("/spin")({
  validateSearch: search,
  head: () => ({ meta: [{ title: "Spin — Mas Mobile Zone" }] }),
  component: SpinPage,
});

function SpinPage() {
  const { code } = Route.useSearch();
  const navigate = useNavigate();
  const consume = useServerFn(consumeAccessCode);
  const record = useServerFn(recordPrizeForCode);
  const [spinning, setSpinning] = useState(false);
  const [target, setTarget] = useState<number | null>(null);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const handleSpin = async () => {
    if (spinning || done) return;
    setError("");
    setSpinning(true);
    // Burn the code IMMEDIATELY before the wheel starts
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
    const winner = pickWinner();
    const idx = PRIZES.findIndex((p) => p.id === winner.id);
    setTarget(idx);
  };

  const handleComplete = (prize: Prize) => {
    setDone(true);
    saveRecord({ name: code, prizeId: prize.id, prizeName: prize.name, isWin: prize.isWin });
    record({ data: { code, prize: prize.name } }).catch(() => {});
    setTimeout(() => {
      navigate({ to: "/result", search: { prize: prize.id, code } });
    }, 600);
  };

  return (
    <div className="min-h-screen flex flex-col items-center px-4 py-6">
      <div className="w-full flex items-center justify-between mb-2">
        <button onClick={() => navigate({ to: "/" })} className="text-sm text-muted-foreground">← Back</button>
        <p className="text-xs uppercase tracking-widest text-gold">Lucky Spin</p>
        <span className="w-10" />
      </div>

      <p className="text-center text-muted-foreground text-sm mb-3">
        Code <span className="text-foreground font-mono font-semibold tracking-widest">{code}</span>
      </p>

      <div className="w-[96vw] max-w-[560px] mt-2">
        <SpinWheel spinning={spinning} targetIndex={target} onComplete={handleComplete} />
      </div>

      {error && <p className="mt-4 text-destructive text-sm text-center">{error}</p>}

      <button
        onClick={handleSpin}
        disabled={spinning || done}
        className="mt-10 w-full max-w-sm gradient-primary text-[#0F1115] font-black text-xl tracking-widest py-5 rounded-2xl glow-orange active:scale-[0.98] transition disabled:opacity-60"
      >
        {spinning ? "SPINNING..." : "SPIN NOW"}
      </button>
    </div>
  );
}
