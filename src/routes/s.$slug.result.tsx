import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import confetti from "canvas-confetti";
import { usePrizesBySlug } from "@/lib/prizes-hook";
import { getPublicShop } from "@/lib/shops.functions";
import { playClick } from "@/lib/sounds";

const search = z.object({
  pid: z.string().min(1).max(64),
  code: z.string().min(1).max(64),
});

export const Route = createFileRoute("/s/$slug/result")({
  validateSearch: search,
  head: ({ params }) => ({ meta: [{ title: `Result — ${params.slug}` }] }),
  component: ResultPage,
});

function ResultPage() {
  const { slug } = Route.useParams();
  const { pid, code } = Route.useSearch();
  const navigate = useNavigate();
  const { prizes, isLoading } = usePrizesBySlug(slug);
  const fetchShop = useServerFn(getPublicShop);
  const shopQuery = useQuery({
    queryKey: ["public-shop", slug],
    queryFn: async () => (await fetchShop({ data: { slug } })).shop,
  });
  const p = prizes.find((x) => x.id === pid);

  useEffect(() => {
    if (p?.isWin) {
      const burst = () => confetti({ particleCount: 80, spread: 75, origin: { y: 0.4 }, colors: ["#FF7A00", "#F5C542", "#ffffff"] });
      burst();
      const t1 = setTimeout(burst, 400);
      const t2 = setTimeout(burst, 900);
      return () => { clearTimeout(t1); clearTimeout(t2); };
    }
  }, [p?.isWin]);

  if (isLoading || !p) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;

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
        {p.isWin && shopQuery.data && (
          <p className="mt-4 text-sm text-muted-foreground max-w-xs mx-auto">
            Claim your prize at <span className="text-foreground font-semibold">{shopQuery.data.name}</span>.
          </p>
        )}
        <p className="mt-3 text-[11px] text-muted-foreground font-mono">Code: {code}</p>

        <button
          onClick={() => { playClick(); navigate({ to: "/s/$slug", params: { slug } }); }}
          className="mt-10 w-full max-w-sm gradient-primary text-[#0F1115] glow-orange font-bold text-lg py-4 rounded-xl"
        >
          Done
        </button>
      </div>
    </div>
  );
}
