import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useRef } from "react";
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
      className="rounded-full bg-white overflow-hidden flex items-center justify-center ring-1 ring-[rgba(12,35,64,0.12)] shadow-sm"
      style={{ width: size, height: size }}
    >
      <img src={DEFAULT_LOGO} alt="The Luck Spin" className="w-full h-full object-contain" />
    </div>
  );
}

function WheelVisual() {
  const segs = 8;
  const colors = ["#0c2340", "#ff6b1a"];
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const wheelRef = useRef<SVGSVGElement>(null);

  const handleSpin = () => {
    if (spinning) return;
    setSpinning(true);
    const turns = 6 + Math.random() * 4;
    const next = rotation + turns * 360 + Math.random() * 360;
    setRotation(next);
    window.setTimeout(() => setSpinning(false), 4200);
  };

  return (
    <div className="relative w-full max-w-[460px] aspect-square mx-auto">
      <div
        aria-hidden
        className="absolute inset-6 rounded-full animate-pulse-gold"
        style={{ background: "radial-gradient(circle, rgba(255,107,26,0.45), transparent 65%)" }}
      />
      {/* outer ring with glowing dots */}
      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-[#0c2340] via-[#1a3a66] to-[#0c2340] shadow-[0_30px_80px_-20px_rgba(12,35,64,0.5)] p-[10px]">
        <div className="relative w-full h-full rounded-full bg-white overflow-hidden ring-4 ring-[#ff6b1a]/30">
          <svg
            ref={wheelRef}
            viewBox="0 0 200 200"
            className="w-full h-full"
            style={{
              transform: `rotate(${rotation}deg)`,
              transition: spinning
                ? "transform 4.2s cubic-bezier(0.17, 0.67, 0.21, 1)"
                : "transform 0.4s ease-out",
            }}
          >
            {Array.from({ length: segs }).map((_, i) => {
              const a1 = ((i * 360) / segs - 90) * (Math.PI / 180);
              const a2 = (((i + 1) * 360) / segs - 90) * (Math.PI / 180);
              const x1 = 100 + 100 * Math.cos(a1);
              const y1 = 100 + 100 * Math.sin(a1);
              const x2 = 100 + 100 * Math.cos(a2);
              const y2 = 100 + 100 * Math.sin(a2);
              const midA = ((i + 0.5) * 360) / segs - 90;
              const tx = 100 + 62 * Math.cos((midA * Math.PI) / 180);
              const ty = 100 + 62 * Math.sin((midA * Math.PI) / 180);
              return (
                <g key={i}>
                  <path
                    d={`M100 100 L${x1} ${y1} A100 100 0 0 1 ${x2} ${y2} Z`}
                    fill={colors[i % 2]}
                    stroke="#ffffff"
                    strokeWidth="1.5"
                  />
                  <text
                    x={tx}
                    y={ty}
                    transform={`rotate(${midA + 90} ${tx} ${ty})`}
                    fill={i % 2 === 0 ? "#ff6b1a" : "#ffffff"}
                    fontSize="11"
                    fontWeight="800"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    {i % 2 === 0 ? "WIN" : "🎁"}
                  </text>
                </g>
              );
            })}
          </svg>
          {/* decorative dots around rim */}
          {Array.from({ length: 16 }).map((_, i) => {
            const a = (i * 360) / 16;
            return (
              <span
                key={i}
                className="absolute w-2 h-2 rounded-full bg-[#ff6b1a] shadow-[0_0_8px_rgba(255,107,26,0.8)]"
                style={{
                  top: "50%",
                  left: "50%",
                  transform: `rotate(${a}deg) translateY(calc(-50% - 47%)) translateX(-50%)`,
                  animation: `pulse-gold 2s ease-in-out ${i * 0.1}s infinite`,
                }}
              />
            );
          })}
        </div>
      </div>
      {/* pointer */}
      <div className="absolute -top-1 left-1/2 -translate-x-1/2 z-10 w-0 h-0 border-l-[14px] border-r-[14px] border-t-[24px] border-l-transparent border-r-transparent border-t-[#ff6b1a] drop-shadow-lg" />
      {/* center hub - clickable spin button */}
      <button
        type="button"
        onClick={handleSpin}
        disabled={spinning}
        aria-label="Spin the wheel"
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-28 h-28 rounded-full bg-white border-[6px] border-[#0c2340] shadow-[0_10px_30px_-5px_rgba(12,35,64,0.5)] flex items-center justify-center hover:scale-105 active:scale-95 transition-transform disabled:cursor-not-allowed cursor-pointer z-20 group"
      >
        <span
          className={`font-display font-bold text-[#ff6b1a] tracking-[0.25em] text-base group-hover:text-[#e85a0c] ${spinning ? "animate-pulse" : ""}`}
        >
          {spinning ? "..." : "SPIN"}
        </span>
      </button>
    </div>
  );
}


function Landing() {
  return (
    <div className="min-h-screen w-full bg-white text-[#0c2340]">
      {/* Nav */}
      <nav className="max-w-7xl mx-auto flex items-center justify-between px-5 md:px-8 py-5">
        <Link to="/" className="flex items-center gap-2.5">
          <BrandMark size={36} />
          <span className="font-display font-bold tracking-tight text-lg text-[#0c2340]">
            theluckspin
          </span>
        </Link>
        <div className="hidden md:flex items-center gap-6">
          <Link
            to="/auth"
            className="text-[#0c2340]/70 hover:text-[#ff6b1a] text-sm font-semibold transition-colors"
          >
            Sign in
          </Link>
          <InstallAppButton
            variant="ghost"
            size="sm"
            className="!text-[#0c2340]/70 hover:!text-[#ff6b1a] text-sm font-semibold"
          />
          <Link
            to="/auth"
            className="px-5 py-2.5 bg-[#ff6b1a] text-white rounded-full text-sm font-bold hover:bg-[#e85a0c] transition-all shadow-[0_8px_24px_-8px_rgba(255,107,26,0.6)]"
          >
            Create your shop
          </Link>
        </div>
        <Link
          to="/auth"
          className="md:hidden px-4 py-2 bg-[#ff6b1a] text-white rounded-full text-xs font-bold"
        >
          Sign in
        </Link>
      </nav>

      {/* Hero split-screen */}
      <section className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-10 lg:gap-16 items-center px-5 md:px-8 pt-6 pb-16 lg:py-20">
        {/* Left copy */}
        <div className="animate-float-up">
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#fff1e8] text-[#ff6b1a] text-[11px] font-bold uppercase tracking-[0.18em]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#ff6b1a]" />
            Growth &amp; retention SaaS
          </span>
          <h1 className="font-display mt-5 text-4xl md:text-5xl lg:text-6xl font-bold leading-[1.05] tracking-tight">
            Run a{" "}
            <span className="relative inline-block">
              <span className="text-[#ff6b1a]">Lucky Spin</span>
              <span className="absolute left-0 right-0 -bottom-1 h-2 bg-[#ff6b1a]/20 -z-0" />
            </span>{" "}
            campaign for your shop.
          </h1>
          <p className="mt-5 text-base md:text-lg text-[#4a5b78] max-w-lg leading-relaxed">
            Brand your spin page, generate access codes, and turn every visit into a memorable
            moment. Built for boutique shops that care how they're seen.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              to="/auth"
              className="px-7 py-3.5 bg-[#0c2340] text-white rounded-full font-bold text-sm hover:bg-[#1a3a66] transition-all shadow-[0_10px_30px_-10px_rgba(12,35,64,0.5)] hover:scale-[1.02]"
            >
              Get started — it's free
            </Link>
            <InstallAppButton
              variant="outline"
              size="lg"
              className="!rounded-full !border-[#0c2340]/20 !text-[#0c2340] !font-semibold !text-sm !px-6 hover:!bg-[#f4f6fa]"
            />
          </div>

          <div className="mt-10 flex flex-wrap gap-x-8 gap-y-4">
            {[
              { k: "10k+", v: "Spins delivered" },
              { k: "98%", v: "Customer delight" },
              { k: "<1min", v: "Setup time" },
            ].map((s) => (
              <div key={s.v}>
                <div className="font-display text-2xl font-bold text-[#0c2340]">{s.k}</div>
                <div className="text-xs uppercase tracking-wider text-[#4a5b78] mt-1">{s.v}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Right visual */}
        <div className="relative">
          <div className="absolute -inset-6 bg-gradient-to-br from-[#fff1e8] via-white to-[#eef3fb] rounded-[2rem] -z-10" />
          <WheelVisual />
        </div>
      </section>

      {/* Steps strip */}
      <section className="bg-[#0c2340] text-white py-16">
        <div className="max-w-7xl mx-auto px-5 md:px-8">
          <div className="flex items-end justify-between mb-10 flex-wrap gap-4">
            <h2 className="font-display text-3xl md:text-4xl font-bold max-w-md leading-tight">
              Launch in three simple steps.
            </h2>
            <Link
              to="/auth"
              className="text-[#ff6b1a] text-sm font-bold hover:underline underline-offset-4"
            >
              Start your shop →
            </Link>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
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
            ].map((s) => (
              <div
                key={s.n}
                className="group bg-white/5 border border-white/10 rounded-2xl p-7 hover:bg-[#ff6b1a] hover:border-[#ff6b1a] transition-all duration-300"
              >
                <div className="flex items-center justify-between mb-5">
                  <span className="font-display text-3xl font-bold text-[#ff6b1a] group-hover:text-white transition-colors">
                    {s.n}
                  </span>
                  <span className="w-10 h-10 rounded-full border border-white/20 group-hover:border-white flex items-center justify-center text-white/60 group-hover:text-white transition-colors">
                    →
                  </span>
                </div>
                <h3 className="font-display text-xl font-bold mb-2">{s.t}</h3>
                <p className="text-white/60 text-sm leading-relaxed group-hover:text-white/90 transition-colors">
                  {s.d}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer trust */}
      <footer className="max-w-7xl mx-auto px-5 md:px-8 py-10 flex flex-wrap items-center justify-between gap-4 border-t border-[#0c2340]/10">
        <div className="flex items-center gap-2.5">
          <BrandMark size={28} />
          <span className="font-display font-bold text-[#0c2340]">theluckspin</span>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          {["Built for boutique retail", "Secure access codes", "Installable PWA"].map((t) => (
            <span
              key={t}
              className="text-[10px] uppercase font-bold tracking-[0.22em] text-[#4a5b78]"
            >
              {t}
            </span>
          ))}
        </div>
      </footer>
    </div>
  );
}
