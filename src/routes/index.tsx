import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { LOGO } from "@/lib/spin-store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Mas Mobile Zone — Lucky Spin Campaign" },
      { name: "description", content: "Spin to win premium electronics from Mas Mobile Zone." },
    ],
  }),
  component: Home,
});

function Home() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [spins, setSpins] = useState(1);
  const [error, setError] = useState("");
  const pressTimer = useRef<number | null>(null);

  const start = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Please enter your name");
      return;
    }
    if (trimmed.length > 60) {
      setError("Name too long");
      return;
    }
    const s = Math.max(1, Math.min(10, Math.floor(spins) || 1));
    navigate({ to: "/spin", search: { name: trimmed, spins: s, round: 1, exclude: "" } });
  };

  const onPressStart = () => {
    pressTimer.current = window.setTimeout(() => {
      const pw = window.prompt("Admin password");
      if (pw === "1234") navigate({ to: "/admin" });
    }, 5000);
  };
  const onPressEnd = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-10">
      <div
        className="relative animate-pulse-glow rounded-full mb-8"
        onPointerDown={onPressStart}
        onPointerUp={onPressEnd}
        onPointerLeave={onPressEnd}
        onPointerCancel={onPressEnd}
      >
        <img
          src={LOGO}
          alt="Mas Mobile Zone"
          className="w-44 h-44 rounded-full object-cover border-2 border-[var(--gold)]/70"
          draggable={false}
        />
      </div>

      <h1 className="text-3xl font-black tracking-[0.18em] text-center">MAS MOBILE ZONE</h1>
      <p className="mt-2 text-sm tracking-[0.32em] text-gold uppercase">Lucky Spin Campaign</p>

      <div className="glass rounded-2xl p-5 mt-10 w-full max-w-sm animate-float-up">
        <label className="text-xs uppercase tracking-widest text-muted-foreground">Customer Name</label>
        <input
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setError("");
          }}
          placeholder="Enter your name"
          maxLength={60}
          className="mt-2 w-full bg-[#0F1115]/70 border border-white/10 rounded-xl px-4 py-3 text-base outline-none focus:border-primary"
        />
        {error && <p className="text-destructive text-sm mt-2">{error}</p>}

        <label className="text-xs uppercase tracking-widest text-muted-foreground block mt-4">
          Number of Spins <span className="text-gold/70 normal-case tracking-normal">(for heavy buyers)</span>
        </label>
        <div className="mt-2 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSpins((s) => Math.max(1, s - 1))}
            className="w-12 h-12 rounded-xl bg-[#0F1115]/70 border border-white/10 text-xl font-bold active:scale-95"
          >−</button>
          <input
            type="number"
            min={1}
            max={10}
            value={spins}
            onChange={(e) => setSpins(Math.max(1, Math.min(10, Number(e.target.value) || 1)))}
            className="flex-1 bg-[#0F1115]/70 border border-white/10 rounded-xl px-4 py-3 text-center text-lg font-bold outline-none focus:border-primary"
          />
          <button
            type="button"
            onClick={() => setSpins((s) => Math.min(10, s + 1))}
            className="w-12 h-12 rounded-xl bg-[#0F1115]/70 border border-white/10 text-xl font-bold active:scale-95"
          >+</button>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">Each spin excludes prizes already won this round.</p>

        <button
          onClick={start}
          className="mt-5 w-full gradient-primary text-[#0F1115] font-bold text-lg py-4 rounded-xl glow-orange active:scale-[0.98] transition"
        >
          START SPIN
        </button>
      </div>

      <p className="mt-8 text-xs text-muted-foreground/60">Premium retail experience</p>
    </div>
  );
}
