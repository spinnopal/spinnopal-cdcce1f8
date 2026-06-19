import { createFileRoute, Link } from "@tanstack/react-router";
import { DEFAULT_LOGO } from "@/lib/spin-store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Lucky Spin — Run prize campaigns for your shop" },
      {
        name: "description",
        content:
          "Launch a branded Lucky Spin campaign for your shop in minutes. Hand customers an access code and let them spin to win.",
      },
      { property: "og:title", content: "Lucky Spin — Run prize campaigns for your shop" },
      {
        property: "og:description",
        content:
          "Launch a branded Lucky Spin campaign for your shop in minutes. Hand customers an access code and let them spin to win.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen flex flex-col items-center px-6 py-12">
      <header className="w-full max-w-5xl flex items-center justify-between mb-12">
        <div className="flex items-center gap-2">
          <img src={DEFAULT_LOGO} alt="" className="w-9 h-9 rounded-full object-cover" />
          <span className="font-black tracking-widest">LUCKY SPIN</span>
        </div>
        <nav className="flex items-center gap-3">
          <Link
            to="/auth"
            className="text-sm px-4 py-2 rounded-lg border border-white/15 hover:border-primary transition"
          >
            Sign in
          </Link>
          <Link
            to="/auth"
            className="text-sm px-4 py-2 rounded-lg gradient-primary text-[#0F1115] font-bold glow-orange"
          >
            Create your shop
          </Link>
        </nav>
      </header>

      <main className="flex-1 w-full max-w-3xl flex flex-col items-center text-center">
        <div className="relative animate-pulse-glow rounded-full mb-8">
          <img
            src={DEFAULT_LOGO}
            alt=""
            className="w-36 h-36 rounded-full object-cover border-2 border-[var(--gold)]/70"
          />
        </div>
        <h1 className="text-4xl md:text-5xl font-black tracking-tight">
          Run a Lucky Spin campaign for <span className="text-gold">your</span> shop
        </h1>
        <p className="mt-5 max-w-xl text-muted-foreground">
          Create your shop, customize the logo and prizes, generate access codes, and share a single
          link with customers. They enter their name and code, then spin to win.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/auth"
            className="px-6 py-3 rounded-xl gradient-primary text-[#0F1115] font-bold glow-orange"
          >
            Get started — it's free
          </Link>
          <Link
            to="/auth"
            className="px-6 py-3 rounded-xl border border-white/15 hover:border-primary transition"
          >
            I already have a shop
          </Link>
        </div>

        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
          <div className="glass rounded-2xl p-5 text-left">
            <p className="text-xs uppercase tracking-widest text-gold">1. Set up</p>
            <p className="mt-2 font-semibold">Brand your spin page</p>
            <p className="text-sm text-muted-foreground mt-1">Upload your logo, name your shop, pick a URL.</p>
          </div>
          <div className="glass rounded-2xl p-5 text-left">
            <p className="text-xs uppercase tracking-widest text-gold">2. Configure</p>
            <p className="mt-2 font-semibold">Prizes & access codes</p>
            <p className="text-sm text-muted-foreground mt-1">Add prizes with photos, set win odds, generate codes to hand out.</p>
          </div>
          <div className="glass rounded-2xl p-5 text-left">
            <p className="text-xs uppercase tracking-widest text-gold">3. Launch</p>
            <p className="mt-2 font-semibold">Share one link</p>
            <p className="text-sm text-muted-foreground mt-1">Customers spin, you see every winner in your dashboard.</p>
          </div>
        </div>
      </main>

      <footer className="mt-16 text-xs text-muted-foreground/60">Premium retail experience</footer>
    </div>
  );
}
