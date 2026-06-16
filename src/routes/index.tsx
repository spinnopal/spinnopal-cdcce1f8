import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { LOGO } from "@/lib/spin-store";
import { validateAccessCode } from "@/lib/access-codes.functions";
import { playClick } from "@/lib/sounds";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Mas Mobile Zone — Lucky Spin Campaign" },
      { name: "description", content: "Enter your access code to spin and win at Mas Mobile Zone." },
    ],
  }),
  component: Home,
});

function Home() {
  const navigate = useNavigate();
  const validate = useServerFn(validateAccessCode);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const pressTimer = useRef<number | null>(null);

  const submit = async () => {
    playClick();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Please enter your name");
      return;
    }
    if (trimmedName.length > 40) {
      setError("Name is too long");
      return;
    }
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) {
      setError("Please enter your access code");
      return;
    }
    if (!/^[A-Z0-9-]+$/.test(trimmed)) {
      setError("Code can only contain letters, numbers, and dashes");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await validate({ data: { code: trimmed } });
      if (!res.ok) {
        setError("This code is invalid or has already been used.");
        setLoading(false);
        return;
      }
      navigate({ to: "/spin", search: { code: res.code, name: trimmedName } });
    } catch {
      setError("Could not verify your code. Please try again.");
      setLoading(false);
    }
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
        <label className="text-xs uppercase tracking-widest text-muted-foreground">Your Name</label>
        <input
          value={name}
          onChange={(e) => { setName(e.target.value); setError(""); }}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="Enter your full name"
          maxLength={40}
          autoCorrect="off"
          spellCheck={false}
          className="mt-2 w-full bg-[#0F1115]/70 border border-white/10 rounded-xl px-4 py-3 text-base outline-none focus:border-primary"
        />

        <label className="text-xs uppercase tracking-widest text-muted-foreground mt-4 block">Access Code</label>
        <input
          value={code}
          onChange={(e) => {
            setCode(e.target.value.toUpperCase());
            setError("");
          }}
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
        <p className="mt-3 text-[11px] text-muted-foreground text-center">
          Each code can be used only once.
        </p>
      </div>

      <p className="mt-8 text-xs text-muted-foreground/60">Premium retail experience</p>
    </div>
  );
}
