import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useRef, useEffect, useMemo } from "react";
import { InstallAppButton } from "@/components/InstallAppButton";
import { DEFAULT_LOGO } from "@/lib/spin-store";
import { playClick, playWin, playLose, startSpinTicks } from "@/lib/sounds";
import { useReducedMotion } from "@/hooks/use-reduced-motion";


function vibrate(pattern: number | number[]) {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(pattern);
    }
  } catch {
    // ignore
  }
}

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}




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

const DEMO_PRIZES = [
  "Rs.2000 Cash",
  "Bass Earphones",
  "Try Again",
  "Ultima Watch",
  "Rs.1000 Cash",
  "Kick AirBuds",
  "Rs.100 Cash",
  "Cooler Wind Fan",
];

function WheelVisual({ reducedMotion }: { reducedMotion: boolean }) {
  const SEG_COUNT = DEMO_PRIZES.length;
  const SEG = 360 / SEG_COUNT;
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [wonPrize, setWonPrize] = useState<string | null>(null);
  const [prizes, setPrizes] = useState<string[]>(DEMO_PRIZES);
  const rotationRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const cancelTicksRef = useRef<(() => void) | null>(null);

  useEffect(() => () => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    if (cancelTicksRef.current) cancelTicksRef.current();
  }, []);

  const size = 360;
  const r = size / 2;
  const cx = r, cy = r;
  const textR = r * 0.7;

  // Precompute segment geometry once — avoids recompute on every render
  const segments = useMemo(() => {
    return Array.from({ length: SEG_COUNT }).map((_, i) => {
      const centerAngle = i * SEG;
      const a1 = (centerAngle - SEG / 2 - 90) * Math.PI / 180;
      const a2 = (centerAngle + SEG / 2 - 90) * Math.PI / 180;
      const x1 = cx + r * Math.cos(a1);
      const y1 = cy + r * Math.sin(a1);
      const x2 = cx + r * Math.cos(a2);
      const y2 = cy + r * Math.sin(a2);
      const isDark = i % 2 === 0;
      const tx = cx + textR * Math.cos((centerAngle - 90) * Math.PI / 180);
      const ty = cy + textR * Math.sin((centerAngle - 90) * Math.PI / 180);
      return {
        path: `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2} Z`,
        isDark,
        tx,
        ty,
        rotate: centerAngle + 90,
      };
    });
  }, [SEG_COUNT, SEG, cx, cy, r, textR]);

  const shortLabel = (name: string) => {
    if (/cash/i.test(name)) return name.replace(/\s*Cash/i, "").replace("Rs.", "₨");
    return name.split(" ")[0];
  };

  const SPIN_DURATION = reducedMotion ? 1200 : 5200;
  const SPIN_EASING = reducedMotion ? "ease-out" : "cubic-bezier(0.16, 1, 0.3, 1)";
  const EXTRA_ROTATIONS = reducedMotion ? 1 : 6;

  const handleSpin = () => {
    if (spinning) return;
    // Reshuffle visible prize names on each spin
    const reshuffled = shuffle(DEMO_PRIZES);
    setPrizes(reshuffled);
    setWonPrize(null);
    setSpinning(true);

    // Haptic + sound at spin start (disabled when reduced motion is on)
    if (!reducedMotion) {
      playClick();
      vibrate(25);
      if (cancelTicksRef.current) cancelTicksRef.current();
      cancelTicksRef.current = startSpinTicks(SPIN_DURATION);
    }

    const targetIndex = Math.floor(Math.random() * SEG_COUNT);
    const center = targetIndex * SEG;
    const base = ((360 - center) % 360 + 360) % 360;
    const current = rotationRef.current;
    const currentMod = ((current % 360) + 360) % 360;
    const delta = ((base - currentMod) + 360) % 360;
    const next = current + EXTRA_ROTATIONS * 360 + delta;
    rotationRef.current = next;
    setRotation(next);
    timerRef.current = window.setTimeout(() => {
      setSpinning(false);
      const prize = reshuffled[targetIndex];
      setWonPrize(prize);
      // Haptic + sound at popup reveal (disabled when reduced motion is on)
      if (!reducedMotion) {
        if (prize === "Try Again") {
          playLose();
          vibrate([60, 40, 60]);
        } else {
          playWin();
          vibrate([30, 50, 30, 50, 120]);
        }
      }
    }, SPIN_DURATION);
  };


  return (
    <div className="relative w-full max-w-[460px] aspect-square mx-auto">
      {!reducedMotion && (
        <div
          aria-hidden
          className="absolute inset-6 rounded-full animate-pulse-gold pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(255,107,26,0.35), transparent 65%)" }}
        />
      )}
      <div
        className="absolute inset-0 rounded-full p-[3%]"
        style={{ background: "linear-gradient(135deg,#1f3460,#3b5a8c)", boxShadow: "0 30px 80px -20px rgba(12,35,64,0.5)" }}
      >
        <div className="w-full h-full rounded-full bg-[#f5f7fb] p-[2%]">
          <div
            className="w-full h-full rounded-full relative overflow-hidden"
            style={{ background: "radial-gradient(circle, #e6edf7 0%, #c8d6ea 70%)" }}
          >
            <svg
              viewBox={`0 0 ${size} ${size}`}
              className="w-full h-full"
              style={{
                transform: `translateZ(0) rotate(${rotation}deg)`,
                transition: spinning ? `transform ${SPIN_DURATION}ms ${SPIN_EASING}` : "none",
                willChange: reducedMotion ? "auto" : "transform",
                backfaceVisibility: "hidden",
                transformOrigin: "50% 50%",
              }}
              shapeRendering="optimizeSpeed"
            >
              {segments.map((s, i) => (
                <g key={i}>
                  <path d={s.path} fill={s.isDark ? "#1f3460" : "#b8cce0"} stroke="#f5f7fb" strokeWidth="2" />
                  <text
                    x={s.tx}
                    y={s.ty}
                    fill={s.isDark ? "#ff6b1a" : "#1f3460"}
                    fontSize="15"
                    fontWeight="800"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    transform={`rotate(${s.rotate} ${s.tx} ${s.ty})`}
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    {shortLabel(prizes[i] ?? "")}

                  </text>
                </g>
              ))}
              <circle cx={cx} cy={cy} r={r * 0.22} fill="#f5f7fb" stroke="#1f3460" strokeWidth="2" />
            </svg>

            <button
              type="button"
              onClick={handleSpin}
              disabled={spinning}
              aria-label="Spin the wheel"
              className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[22%] h-[22%] rounded-full bg-white border-2 border-[#1f3460] shadow-[0_10px_30px_-5px_rgba(12,35,64,0.5)] flex items-center justify-center disabled:cursor-not-allowed cursor-pointer z-20 ${
                reducedMotion ? "" : "hover:scale-105 active:scale-95 transition-transform"
              }`}
            >
              <span className={`font-display font-bold text-[#ff6b1a] tracking-[0.2em] text-sm ${
                reducedMotion ? "" : "animate-pulse"
              }`}>
                {spinning ? "..." : "SPIN"}
              </span>
            </button>
          </div>
        </div>
      </div>


      {/* pointer */}
      <div className="absolute left-1/2 -top-2 -translate-x-1/2 z-10 drop-shadow-[0_4px_10px_rgba(31,52,96,0.5)]">
        <svg width="44" height="56" viewBox="0 0 44 56">
          <defs>
            <linearGradient id="gp-landing" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ff8c4a" />
              <stop offset="60%" stopColor="#ff6b1a" />
              <stop offset="100%" stopColor="#c64a08" />
            </linearGradient>
          </defs>
          <path d="M22 54 L4 12 Q22 0 40 12 Z" fill="url(#gp-landing)" stroke="#c64a08" strokeWidth="1.5" />
          <circle cx="22" cy="14" r="4" fill="#fff" />
        </svg>
      </div>

      {/* Premium prize popup */}
      {wonPrize && (
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0c2340]/70 backdrop-blur-sm ${
            reducedMotion ? "" : "animate-fade-in"
          }`}
          onClick={() => setWonPrize(null)}
        >
          <div
            className={`relative w-full max-w-sm rounded-3xl bg-white shadow-[0_30px_80px_-10px_rgba(12,35,64,0.6)] overflow-hidden ${
              reducedMotion ? "" : "animate-scale-in"
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gradient-to-br from-[#0c2340] via-[#1a3a66] to-[#0c2340] px-6 pt-8 pb-14 text-center relative overflow-hidden">
              <div className="absolute inset-0 opacity-30" style={{ background: "radial-gradient(circle at 50% 0%, rgba(255,107,26,0.6), transparent 60%)" }} />
              <div className="relative">
                <span className="inline-block text-[11px] font-bold uppercase tracking-[0.3em] text-[#ff6b1a]">
                  {wonPrize === "Try Again" ? "So close!" : "Congratulations"}
                </span>
                <div className="mt-3 text-5xl">{wonPrize === "Try Again" ? "🎯" : "🎉"}</div>
              </div>
            </div>
            <div className="px-6 pt-6 pb-7 text-center -mt-8">
              <div className="mx-auto inline-block px-5 py-2 rounded-full bg-white border border-[#0c2340]/10 shadow-md text-xs font-bold uppercase tracking-widest text-[#0c2340]">
                {wonPrize === "Try Again" ? "Result" : "You won"}
              </div>
              <h3 className="font-display mt-4 text-3xl font-bold text-[#0c2340] leading-tight">
                {wonPrize}
              </h3>
              <p className="mt-2 text-sm text-[#4a5b78]">
                {wonPrize === "Try Again"
                  ? "Better luck next spin — give it another go!"
                  : "This is a demo spin. Create your shop to run real campaigns."}
              </p>
              <div className="mt-6 flex flex-col gap-2.5">
                <button
                  onClick={() => { setWonPrize(null); setTimeout(handleSpin, reducedMotion ? 0 : 150); }}
                  className="w-full py-3.5 rounded-full bg-[#ff6b1a] text-white font-bold text-sm tracking-wide hover:bg-[#e85a0c] transition-all shadow-[0_10px_30px_-10px_rgba(255,107,26,0.7)] hover:scale-[1.02]"
                >
                  Spin Again
                </button>
                <button
                  onClick={() => setWonPrize(null)}
                  className="w-full py-2.5 rounded-full text-[#0c2340]/60 font-semibold text-xs hover:text-[#0c2340] transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}



function Landing() {
  const [reducedMotion, setReducedMotion] = useReducedMotion();

  return (
    <div className={`min-h-screen w-full bg-white text-[#0c2340] ${reducedMotion ? "motion-reduce-safe" : ""}`}>

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
        <div className={reducedMotion ? "" : "animate-float-up"}>
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
          <WheelVisual reducedMotion={reducedMotion} />
          <button
            type="button"
            onClick={() => setReducedMotion(!reducedMotion)}
            className="mx-auto mt-5 flex items-center justify-center gap-2 px-4 py-2 rounded-full border border-[#0c2340]/10 bg-white/80 text-xs font-semibold text-[#4a5b78] hover:text-[#0c2340] hover:border-[#0c2340]/20 transition-colors"
            aria-pressed={reducedMotion}
            aria-label={reducedMotion ? "Enable full wheel motion and sound" : "Reduce wheel motion and sound"}
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden>
              {reducedMotion ? (
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
              ) : (
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11H7v-2h10v2z" />
              )}
            </svg>
            <span>{reducedMotion ? "Motion reduced" : "Reduce motion"}</span>
          </button>
          <p className="text-center mt-2 text-[11px] text-[#4a5b78]/70">
            {reducedMotion
              ? "Short spins, no haptics, no sound."
              : "Honours your device’s reduced-motion preference."}
          </p>
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
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <a
            href="https://wa.me/9779769402069"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#0c2340] hover:text-[#25D366] transition-colors"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden>
              <path d="M.057 24l1.687-6.163a11.867 11.867 0 01-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 018.413 3.488 11.824 11.824 0 013.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 01-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zM17.472 14.382c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
            </svg>
            <span>9769402069</span>
          </a>
          <a
            href="mailto:theluckspin@gmail.com"
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#0c2340] hover:text-[#ff6b1a] transition-colors"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden>
              <path d="M12 12.713L.015 3h23.97L12 12.713zM12 14.713L0 5v15h24V5l-12 9.713z"/>
            </svg>
            <span>theluckspin@gmail.com</span>
          </a>
        </div>

      </footer>
    </div>
  );
}
