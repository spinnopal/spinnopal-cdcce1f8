import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { z } from "zod";
import confetti from "canvas-confetti";
import { PRIZES, type PrizeId } from "@/lib/spin-store";

const search = z.object({
  prize: z.enum(["cable", "earphones", "ultima", "kick", "cash2000", "cash1000", "try-again", "cash100"]),
  name: z.string(),
  spins: z.number().int().min(1).max(10).optional().default(1),
  round: z.number().int().min(1).max(10).optional().default(1),
  exclude: z.string().optional().default(""),
});

export const Route = createFileRoute("/result")({
  validateSearch: search,
  head: () => ({ meta: [{ title: "Result — Mas Mobile Zone" }] }),
  component: ResultPage,
});

function ResultPage() {
  const { prize, name, spins, round, exclude } = Route.useSearch();
  const navigate = useNavigate();
  const p = PRIZES.find((x) => x.id === (prize as PrizeId))!;
  const hasMoreSpins = round < spins;

  useEffect(() => {
    if (p.isWin) {
      const burst = () => {
        confetti({ particleCount: 80, spread: 75, origin: { y: 0.4 }, colors: ["#FF7A00", "#F5C542", "#ffffff"] });
      };
      burst();
      const t1 = setTimeout(burst, 400);
      const t2 = setTimeout(burst, 900);
      return () => { clearTimeout(t1); clearTimeout(t2); };
    }
  }, [p.isWin]);

  const nextSpin = () => {
    navigate({
      to: "/spin",
      search: { name, spins, round: round + 1, exclude },
    });
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-10 text-center">
      <div className="animate-float-up">
        <div className={`w-64 h-64 rounded-3xl overflow-hidden mx-auto ${p.isWin ? "glow-orange" : ""} bg-[#0F1115] border border-white/10`}>
          <img src={p.image} alt={p.name} className="w-full h-full object-cover" />
        </div>

        <h2 className="mt-8 text-2xl font-black tracking-wide">
          {p.isWin ? "Congratulations!" : "Better Luck Next Time!"}
        </h2>
        {p.isWin && <p className="mt-2 text-muted-foreground">You Won</p>}
        <p className={`mt-2 text-3xl font-black ${p.isWin ? "text-gold" : "text-foreground"}`}>
          {p.isWin ? p.name : "Try Again"}
        </p>
        {p.isWin && (
          <p className="mt-4 text-sm text-muted-foreground max-w-xs mx-auto">
            {name}, claim your prize at <span className="text-foreground font-semibold">Mas Mobile Zone</span>.
          </p>
        )}

        {hasMoreSpins && (
          <button
            onClick={nextSpin}
            className="mt-10 w-full max-w-sm gradient-primary text-[#0F1115] font-bold text-lg py-4 rounded-xl glow-orange"
          >
            Next Spin ({round + 1} of {spins})
          </button>
        )}
        <button
          onClick={() => navigate({ to: "/" })}
          className={`${hasMoreSpins ? "mt-3 bg-secondary text-foreground" : "mt-10 gradient-primary text-[#0F1115] glow-orange"} w-full max-w-sm font-bold text-lg py-4 rounded-xl`}
        >
          Done
        </button>
      </div>
    </div>
  );
}
