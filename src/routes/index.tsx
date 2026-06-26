import { createFileRoute, Link } from "@tanstack/react-router";
import { InstallAppButton } from "@/components/InstallAppButton";
import { DEFAULT_LOGO } from "@/lib/spin-store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "The Luck Spin — Premium prize campaigns for boutique shops" },
      {
        name: "description",
        content:
          "The Luck Spin — Spin · Win · Enjoy. Brand your spin page, generate access codes, and watch every win in your dashboard.",
      },
      { property: "og:title", content: "The Luck Spin — Spin · Win · Enjoy" },
      {
        property: "og:description",
        content:
          "Brand your spin page, generate access codes, and run campaigns customers remember.",
      },
    ],
  }),
  component: Landing,
});

function BrandMark({ size = 36 }: { size?: number }) {
  return (
    <div
      className="rounded-full bg-cream overflow-hidden flex items-center justify-center shadow-[0_0_20px_-4px_rgba(184,204,224,0.7)] ring-1 ring-[rgba(184,204,224,0.4)]"
      style={{ width: size, height: size }}
    >
      <img src={DEFAULT_LOGO} alt="The Luck Spin" className="w-full h-full object-contain" />
    </div>
  );
}

function Landing() {
  return (
    <div className="min-h-screen w-full flex flex-col items-center px-3 py-6 md:p-10 select-none">
      {/* Framed boutique card */}
      <div className="max-w-7xl w-full bg-emerald-deep rounded-3xl overflow-hidden shadow-2xl border border-[rgba(201,168,76,0.22)] flex flex-col animate-float-up">
        {/* Navigation */}
        <nav className="w-full flex items-center justify-between px-5 md:px-8 py-5 md:py-6 border-b border-[rgba(201,168,76,0.12)]">
          <Link to="/" className="flex items-center gap-2.5">
            <BrandMark size={32} />
            <span
              className="font-display font-bold tracking-tight text-lg md:text-xl text-cream"
            >
              theluckspin
            </span>
          </Link>
          <div className="hidden md:flex items-center gap-7">
            <Link
              to="/auth"
              className="text-cream/70 hover:text-gold text-xs font-semibold transition-colors uppercase tracking-[0.2em]"
            >
              Sign in
            </Link>
            <InstallAppButton
              variant="ghost"
              size="sm"
              className="!text-cream/70 hover:!text-gold uppercase tracking-[0.2em] text-xs font-semibold"
            />
            <Link
              to="/auth"
              className="px-5 py-2.5 bg-gold text-emerald-deep rounded-full text-[11px] font-bold uppercase tracking-[0.2em] hover:bg-cream transition-all duration-300 glow-gold"
            >
              Create your shop
            </Link>
          </div>
          {/* Mobile compact CTA */}
          <Link
            to="/auth"
            className="md:hidden px-3.5 py-2 bg-gold text-emerald-deep rounded-full text-[10px] font-bold uppercase tracking-[0.18em]"
          >
            Sign in
          </Link>
        </nav>

        {/* Hero split */}
        <div className="flex flex-col lg:flex-row min-h-[560px]">
          {/* Left */}
          <div className="flex-1 flex flex-col justify-center px-6 md:px-10 lg:px-16 py-12 lg:py-16">
            <span className="text-gold text-[11px] font-bold uppercase tracking-[0.3em] mb-5">
              Growth &amp; retention SaaS
            </span>
            <h1 className="font-display text-cream text-4xl md:text-5xl lg:text-7xl font-light leading-[1.05] mb-6">
              Run a{" "}
              <span className="text-gold italic font-normal">Lucky Spin</span> campaign for your shop
            </h1>
            <p className="text-cream/65 text-base md:text-lg max-w-lg mb-10 leading-relaxed">
              Brand your spin page, generate access codes, and turn every visit into a memorable
              moment. Built for boutique shops that care how they're seen.
            </p>

            <div className="flex flex-wrap items-center gap-3 md:gap-4">
              <Link
                to="/auth"
                className="px-7 py-3.5 md:px-8 md:py-4 bg-gold text-emerald-deep rounded-full font-bold uppercase tracking-[0.2em] text-xs md:text-sm shadow-lg shadow-[rgba(201,168,76,0.25)] hover:scale-[1.03] transition-transform"
              >
                Get started
              </Link>
              <InstallAppButton
                variant="outline"
                size="lg"
                className="!rounded-full !border-[rgba(201,168,76,0.35)] !text-cream uppercase tracking-[0.2em] !text-xs md:!text-sm font-bold !px-6 !py-4 hover:!bg-emerald-mid hover:!text-cream"
              />
              <Link
                to="/auth"
                className="text-gold text-[11px] font-bold uppercase tracking-[0.22em] hover:underline underline-offset-4"
              >
                I already have a shop
              </Link>
            </div>
          </div>

          {/* Right visual */}
          <div className="flex-1 bg-[rgba(13,122,95,0.28)] flex items-center justify-center p-8 md:p-10 relative overflow-hidden min-h-[340px]">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(13,122,95,0.45),transparent_65%)]" />
            {/* Pulsing gold halo */}
            <div
              aria-hidden
              className="absolute rounded-full bg-gold/30 blur-3xl animate-pulse-gold"
              style={{ width: 340, height: 340 }}
            />

            {/* Wheel */}
            <div className="relative w-72 h-72 md:w-[420px] md:h-[420px] rounded-full border-[10px] md:border-[12px] border-emerald-deep shadow-[0_0_80px_rgba(201,168,76,0.18)] flex items-center justify-center">
              {/* Rotating hairline ring */}
              <div className="absolute inset-0 rounded-full border-2 border-[rgba(201,168,76,0.35)] animate-slow-spin" />
              <div className="absolute inset-3 rounded-full border border-[rgba(201,168,76,0.18)]" />

              {/* Segments */}
              <div className="absolute inset-[10px] rounded-full overflow-hidden opacity-80">
                <div className="absolute inset-0 grid grid-cols-2 grid-rows-2">
                  <div className="border-r border-b border-[rgba(201,168,76,0.12)] bg-gradient-to-br from-emerald-deep to-emerald-mid" />
                  <div className="border-b border-[rgba(201,168,76,0.12)] bg-gradient-to-bl from-emerald-mid to-emerald-deep" />
                  <div className="border-r border-[rgba(201,168,76,0.12)] bg-gradient-to-tr from-emerald-mid to-emerald-deep" />
                  <div className="bg-gradient-to-tl from-emerald-deep to-emerald-mid" />
                </div>
              </div>

              {/* Top indicator */}
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[10px] border-r-[10px] border-t-[16px] border-l-transparent border-r-transparent border-t-gold drop-shadow-[0_2px_6px_rgba(0,0,0,0.35)]" />

              {/* Gold center */}
              <div className="relative z-10 w-20 h-20 md:w-24 md:h-24 rounded-full bg-gold border-[6px] md:border-[8px] border-emerald-deep shadow-2xl flex items-center justify-center">
                <span className="text-emerald-deep font-display font-bold text-[11px] tracking-[0.18em]">
                  SPIN
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 3 steps */}
        <div className="grid grid-cols-1 md:grid-cols-3 border-t border-[rgba(201,168,76,0.12)] bg-[rgba(13,122,95,0.1)]">
          {[
            {
              n: "01",
              t: "Set up",
              d: "Upload your logo, name your shop, and claim your branded URL in under a minute.",
            },
            {
              n: "02",
              t: "Configure",
              d: "Add prizes with photos, tune win odds, and generate access codes to hand out.",
            },
            {
              n: "03",
              t: "Launch",
              d: "Share one link. Customers spin, you see every winner in your dashboard.",
            },
          ].map((s, i) => (
            <div
              key={s.n}
              className={`p-8 md:p-12 group hover:bg-emerald-deep transition-colors ${
                i < 2 ? "md:border-r border-b md:border-b-0 border-[rgba(201,168,76,0.12)]" : ""
              }`}
            >
              <span className="text-gold text-[10px] font-bold uppercase tracking-[0.4em] mb-4 block">
                Step {s.n}
              </span>
              <h3 className="font-display text-cream text-xl md:text-2xl font-medium mb-3">
                {s.t}
              </h3>
              <p className="text-cream/45 text-sm leading-relaxed group-hover:text-cream/65 transition-colors">
                {s.d}
              </p>
              <div className="mt-6 hairline w-0 group-hover:w-full transition-[width] duration-500" />
            </div>
          ))}
        </div>
      </div>

      {/* Trust strip */}
      <div className="mt-7 mb-2 flex flex-wrap justify-center gap-x-8 gap-y-2 text-center">
        <span className="text-cream/40 text-[10px] uppercase font-bold tracking-[0.3em]">
          Built for boutique retail
        </span>
        <span className="text-cream/40 text-[10px] uppercase font-bold tracking-[0.3em]">
          Secure access codes
        </span>
        <span className="text-cream/40 text-[10px] uppercase font-bold tracking-[0.3em]">
          Installable PWA
        </span>
      </div>
    </div>
  );
}
