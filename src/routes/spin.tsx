import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { SpinWheel } from "@/components/SpinWheel";
import { PRIZES, pickWinner, saveRecord, type Prize } from "@/lib/spin-store";
import { z } from "zod";

const search = z.object({ name: z.string().min(1).max(60) });

export const Route = createFileRoute("/spin")({
  validateSearch: search,
  head: () => ({ meta: [{ title: "Spin — Mas Mobile Zone" }] }),
  component: SpinPage,
});

function SpinPage() {
  const { name } = Route.useSearch();
  const navigate = useNavigate();
  const [spinning, setSpinning] = useState(false);
  const [target, setTarget] = useState<number | null>(null);
  const [done, setDone] = useState(false);

  const handleSpin = () => {
    if (spinning || done) return;
    const winner = pickWinner();
    const idx = PRIZES.findIndex((p) => p.id === winner.id);
    setTarget(idx);
    setSpinning(true);
  };

  const handleComplete = (prize: Prize) => {
    setDone(true);
    saveRecord({ name, prizeId: prize.id, prizeName: prize.name, isWin: prize.isWin });
    setTimeout(() => {
      navigate({ to: "/result", search: { prize: prize.id, name } });
    }, 600);
  };

  return (
    <div className="min-h-screen flex flex-col items-center px-4 py-6">
      <div className="w-full flex items-center justify-between mb-2">
        <button onClick={() => navigate({ to: "/" })} className="text-sm text-muted-foreground">← Back</button>
        <p className="text-xs uppercase tracking-widest text-gold">Lucky Spin</p>
        <span className="w-10" />
      </div>

      <p className="text-center text-muted-foreground text-sm mb-4">
        Good luck, <span className="text-foreground font-semibold">{name}</span>
      </p>

      <div className="w-[85vw] max-w-[440px] mt-2">
        <SpinWheel spinning={spinning} targetIndex={target} onComplete={handleComplete} />
      </div>

      <button
        onClick={handleSpin}
        disabled={spinning}
        className="mt-10 w-full max-w-sm gradient-primary text-[#0F1115] font-black text-xl tracking-widest py-5 rounded-2xl glow-orange active:scale-[0.98] transition disabled:opacity-60"
      >
        {spinning ? "SPINNING..." : "SPIN NOW"}
      </button>
    </div>
  );
}
