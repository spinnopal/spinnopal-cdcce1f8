import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import confetti from "canvas-confetti";
import { toast } from "sonner";
import { Copy } from "lucide-react";
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
  const [copied, setCopied] = useState(false);

  const summary =
    p?.isWin
      ? `🎉 I just won ${p.name} on Mas Spin! Claim code: ${code}. Play at ${typeof window !== "undefined" ? window.location.href : ""}`
      : `I spun the wheel on Mas Spin. Code: ${code}. Try your luck too!`;

  const shareToWhatsApp = () => {
    playClick();
    const url = `https://wa.me/?text=${encodeURIComponent(summary)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const copySummary = async () => {
    playClick();
    try {
      await navigator.clipboard.writeText(summary);
      setCopied(true);
      toast.success("Summary copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy summary");
    }
  };

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

        {p.isWin && (
          <div className="mt-4 flex gap-3 justify-center max-w-sm mx-auto">
            <button
              onClick={shareToWhatsApp}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-white/20 bg-white/5 hover:bg-white/10 text-foreground font-semibold transition-colors"
              aria-label="Share to WhatsApp"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current" aria-hidden="true">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075a8.058 8.058 0 0 1-2.356-1.458 8.84 8.84 0 0 1-1.639-2.03c-.173-.297-.018-.458.13-.607.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.36 7.829h-.004c-1.054 0-2.088-.288-2.99-.821l-.214-.128-2.221.582.594-2.166-.139-.222a6.224 6.224 0 0 1-1.158-3.644c0-3.431 2.79-6.22 6.22-6.22 1.662 0 3.225.648 4.4 1.824a6.196 6.196 0 0 1 1.824 4.4c0 3.431-2.79 6.22-6.222 6.22M12 2C6.477 2 2 6.477 2 12c0 1.89.53 3.668 1.453 5.182L2 22l5.026-1.31A9.973 9.973 0 0 0 12 22c5.523 0 10-4.477 10-10S17.523 2 12 2"/>
              </svg>
              WhatsApp
            </button>
            <button
              onClick={copySummary}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-white/20 bg-white/5 hover:bg-white/10 text-foreground font-semibold transition-colors"
              aria-label="Copy summary"
            >
              <Copy className="w-5 h-5" />
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
