import { createFileRoute, useNavigate, notFound } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { getPublicShop } from "@/lib/shops.functions";
import { validateAccessCode } from "@/lib/access-codes.functions";
import { DEFAULT_LOGO } from "@/lib/spin-store";
import { playClick } from "@/lib/sounds";

const entrySearch = z.object({
  code: z.string().min(1).max(64).optional(),
});

export const Route = createFileRoute("/s/$slug/")({
  validateSearch: entrySearch,
  head: ({ params }) => ({
    meta: [
      { title: `${params.slug} — Lucky Spin` },
      { name: "description", content: `Enter your access code to spin and win.` },
    ],
  }),
  component: ShopEntry,
  errorComponent: () => (
    <div className="min-h-screen flex items-center justify-center text-muted-foreground">
      Could not load this shop.
    </div>
  ),
  notFoundComponent: () => (
    <div className="min-h-screen flex items-center justify-center text-muted-foreground">
      Shop not found or unavailable.
    </div>
  ),
});

function ShopEntry() {
  const { slug } = Route.useParams();
  const { code: prefillCode } = Route.useSearch();
  const navigate = useNavigate();
  const fetchShop = useServerFn(getPublicShop);
  const validate = useServerFn(validateAccessCode);

  const shopQuery = useQuery({
    queryKey: ["public-shop", slug],
    queryFn: async () => (await fetchShop({ data: { slug } })).shop,
  });

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (shopQuery.isLoading) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;
  }
  if (!shopQuery.data) {
    throw notFound();
  }
  const shop = shopQuery.data;
  const logo = shop.logo_url || DEFAULT_LOGO;

  const submit = async () => {
    playClick();
    const trimmedName = name.trim();
    if (!trimmedName) return setError("Please enter your name");
    if (trimmedName.length > 40) return setError("Name is too long");
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return setError("Please enter your access code");
    if (!/^[A-Z0-9-]+$/.test(trimmed)) return setError("Code can only contain letters, numbers, dashes");
    setLoading(true);
    setError("");
    try {
      const res = await validate({ data: { slug, code: trimmed } });
      if (!res.ok) {
        setError("This code is invalid or has already been used.");
        setLoading(false);
        return;
      }
      navigate({ to: "/s/$slug/spin", params: { slug }, search: { code: res.code, name: trimmedName } });
    } catch {
      setError("Could not verify your code. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-10">
      <div className="relative animate-pulse-glow rounded-full mb-8">
        <img
          src={logo}
          alt={shop.name}
          className="w-44 h-44 rounded-full object-cover border-2 border-[var(--gold)]/70"
          draggable={false}
        />
      </div>
      <h1 className="text-3xl font-black tracking-[0.18em] text-center uppercase">{shop.name}</h1>
      <p className="mt-2 text-sm tracking-[0.32em] text-gold uppercase">Lucky Spin Campaign</p>

      <div className="glass rounded-2xl p-5 mt-10 w-full max-w-sm animate-float-up">
        <label className="text-xs uppercase tracking-widest text-muted-foreground">Your Name</label>
        <input
          value={name}
          onChange={(e) => { setName(e.target.value); setError(""); }}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="Enter your full name"
          maxLength={40}
          className="mt-2 w-full bg-[#0F1115]/70 border border-white/10 rounded-xl px-4 py-3 text-base outline-none focus:border-primary"
        />

        <label className="text-xs uppercase tracking-widest text-muted-foreground mt-4 block">Access Code</label>
        <input
          value={code}
          onChange={(e) => { setCode(e.target.value.toUpperCase()); setError(""); }}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="Enter your unique access code"
          maxLength={32}
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          className="mt-2 w-full bg-[#0F1115]/70 border border-white/10 rounded-xl px-4 py-3 text-base tracking-widest text-center font-mono outline-none focus:border-primary"
        />
        {error && <p className="text-destructive text-sm mt-2 text-center">{error}</p>}

        <button
          onClick={submit}
          disabled={loading}
          className="mt-5 w-full gradient-primary text-[#0F1115] font-bold text-lg py-4 rounded-xl glow-orange active:scale-[0.98] transition disabled:opacity-60"
        >
          {loading ? "VERIFYING..." : "SUBMIT"}
        </button>
        <p className="mt-3 text-[11px] text-muted-foreground text-center">Each code can be used only once.</p>
      </div>
    </div>
  );
}
