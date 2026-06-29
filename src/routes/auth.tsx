import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { createShop, listMyShops } from "@/lib/shops.functions";
import { isValidEmail } from "@/lib/validation";
import { DEFAULT_LOGO } from "@/lib/spin-store";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Lucky Spin" },
      { name: "description", content: "Create a shop or sign in to manage your Lucky Spin campaign." },
    ],
  }),
  component: AuthPage,
});

type Step = "form" | "verify";

function AuthPage() {
  const navigate = useNavigate();
  const create = useServerFn(createShop);
  const listShops = useServerFn(listMyShops);

  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [step, setStep] = useState<Step>("form");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [shopName, setShopName] = useState("");
  const [slug, setSlug] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  const onForgotPassword = async () => {
    setError("");
    setInfo("");
    if (!isValidEmail(email)) {
      setError("Enter your email above, then tap Forgot password");
      return;
    }
    setResetLoading(true);
    try {
      const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (err) throw err;
      try { sessionStorage.setItem("reset_email", email); } catch {}
      setInfo("We sent a 6-digit code to your email. Open Reset Password to enter it.");
      setTimeout(() => navigate({ to: "/reset-password" }), 800);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send reset email");
    } finally {
      setResetLoading(false);
    }
  };

  const interactedRef = useRef(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled || interactedRef.current) return;
      if (data.session) navigate({ to: "/dashboard" });
    })();
    return () => { cancelled = true; };
  }, [navigate]);

  const autoSlug = (s: string) =>
    s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setInfo("");
    setLoading(true);
    try {
      if (!isValidEmail(email)) throw new Error("Please enter a valid email address");
      if (!password || password.length < 6) throw new Error("Password must be at least 6 characters");

      if (mode === "signup") {
        const desiredSlug = slug || autoSlug(shopName);
        if (!shopName.trim()) throw new Error("Shop name is required");
        if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(desiredSlug))
          throw new Error("Shop URL can only contain lowercase letters, numbers and dashes");

        const { error: signUpErr } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/auth` },
        });
        if (signUpErr) throw signUpErr;

        let sess = (await supabase.auth.getSession()).data.session;
        if (!sess) {
          try {
            sessionStorage.setItem(
              "pending_shop",
              JSON.stringify({ name: shopName.trim(), slug: desiredSlug, email }),
            );
          } catch {}
          setInfo(`We sent a 6-digit verification code to ${email}. Enter it below to finish creating your shop.`);
          setStep("verify");
          return;
        }
        await create({ data: { name: shopName.trim(), slug: desiredSlug, email } });
        navigate({ to: "/dashboard" });
      } else {
        const { error: e1 } = await supabase.auth.signInWithPassword({ email, password });
        if (e1) throw e1;
        try {
          const pending = sessionStorage.getItem("pending_shop");
          if (pending) {
            const p = JSON.parse(pending);
            const existing = await listShops();
            if (existing.shops.length === 0 && p?.name && p?.slug) {
              await create({ data: { name: p.name, slug: p.slug, email: p.email || email } });
            }
            sessionStorage.removeItem("pending_shop");
          }
        } catch {}
        navigate({ to: "/dashboard" });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const onVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setInfo("");
    setLoading(true);
    try {
      const token = code.replace(/\s+/g, "");
      if (!/^\d{6}$/.test(token)) throw new Error("Enter the 6-digit code from your email");
      const { error: verr } = await supabase.auth.verifyOtp({ email, token, type: "email" });
      if (verr) throw verr;
      // Create shop now that the user is verified + signed in.
      try {
        const pending = sessionStorage.getItem("pending_shop");
        const p = pending ? JSON.parse(pending) : { name: shopName.trim(), slug: slug || autoSlug(shopName), email };
        const existing = await listShops();
        if (existing.shops.length === 0 && p?.name && p?.slug) {
          await create({ data: { name: p.name, slug: p.slug, email: p.email || email } });
        }
        sessionStorage.removeItem("pending_shop");
      } catch {}
      navigate({ to: "/dashboard" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid or expired code");
    } finally {
      setLoading(false);
    }
  };

  const onResendCode = async () => {
    setError(""); setInfo("");
    try {
      const { error: rerr } = await supabase.auth.resend({ type: "signup", email });
      if (rerr) throw rerr;
      setInfo("A new code was sent to your email.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not resend code");
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-10">
      <img src={DEFAULT_LOGO} alt="" className="w-20 h-20 rounded-full object-cover mb-4 opacity-90" />
      <h1 className="text-2xl font-black tracking-wider mb-1">LUCKY SPIN</h1>
      <p className="text-xs tracking-[0.3em] text-gold uppercase mb-8">Shop Owner Portal</p>

      {step === "verify" ? (
        <form onSubmit={onVerifyCode} className="glass rounded-2xl p-5 w-full max-w-sm space-y-3">
          <h2 className="text-lg font-bold text-[#0c2340]">Verify your email</h2>
          <p className="text-sm text-muted-foreground">Enter the 6-digit code we sent to <strong>{email}</strong>.</p>
          <label className="text-xs uppercase tracking-widest text-muted-foreground">Verification code</label>
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            placeholder="123456"
            className="w-full bg-[#F5F7FA] border border-[#0c2340]/10 rounded-xl px-4 py-3 text-center tracking-[0.5em] text-xl text-[#0c2340] outline-none focus:border-[#ff6b1a]"
          />
          {error && <p className="text-destructive text-sm">{error}</p>}
          {info && <p className="text-sm text-emerald-400">{info}</p>}
          <button type="submit" disabled={loading} className="w-full gradient-primary text-[#0F1115] font-bold py-3 rounded-xl glow-orange disabled:opacity-60">
            {loading ? "Verifying…" : "Verify & create shop"}
          </button>
          <div className="flex justify-between text-xs">
            <button type="button" onClick={onResendCode} className="text-primary hover:underline">Resend code</button>
            <button type="button" onClick={() => { setStep("form"); setCode(""); }} className="text-muted-foreground">← Back</button>
          </div>
        </form>
      ) : (
        <form onSubmit={onSubmit} onInput={() => { interactedRef.current = true; }} className="glass rounded-2xl p-5 w-full max-w-sm space-y-3">
          <div className="flex gap-2 mb-1">
            <button type="button" onClick={() => setMode("signup")} className={`flex-1 py-2 rounded-lg text-sm font-semibold ${mode === "signup" ? "gradient-primary text-[#0c2340]" : "bg-[#0c2340]/10 text-[#0c2340]/70"}`}>Create shop</button>
            <button type="button" onClick={() => setMode("signin")} className={`flex-1 py-2 rounded-lg text-sm font-semibold ${mode === "signin" ? "gradient-primary text-[#0c2340]" : "bg-[#0c2340]/10 text-[#0c2340]/70"}`}>Sign in</button>
          </div>

          {mode === "signup" && (
            <>
              <label className="text-xs uppercase tracking-widest text-muted-foreground">Shop name</label>
              <input value={shopName} onChange={(e) => { setShopName(e.target.value); if (!slug) setSlug(autoSlug(e.target.value)); }} placeholder="My Mobile Shop" maxLength={80} className="w-full bg-[#F5F7FA] border border-[#0c2340]/10 rounded-xl px-4 py-3 text-base text-[#0c2340] placeholder:text-[#0c2340]/50 outline-none focus:border-[#ff6b1a]" />
              <label className="text-xs uppercase tracking-widest text-muted-foreground">Shop URL</label>
              <div className="flex items-center bg-[#F5F7FA] border border-[#0c2340]/10 rounded-xl px-4 py-3">
                <span className="text-[#0c2340]/50 text-sm mr-1">/s/</span>
                <input value={slug} onChange={(e) => setSlug(autoSlug(e.target.value))} placeholder="my-mobile-shop" maxLength={40} className="flex-1 bg-transparent text-base text-[#0c2340] placeholder:text-[#0c2340]/50 outline-none" />
              </div>
            </>
          )}

          <label className="text-xs uppercase tracking-widest text-muted-foreground">Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" className="w-full bg-[#F5F7FA] border border-[#0c2340]/10 rounded-xl px-4 py-3 text-base text-[#0c2340] placeholder:text-[#0c2340]/50 outline-none focus:border-[#ff6b1a]" />
          <label className="text-xs uppercase tracking-widest text-muted-foreground">Password</label>
          <div className="relative">
            <input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} autoComplete={mode === "signup" ? "new-password" : "current-password"} className="w-full bg-[#F5F7FA] border border-[#0c2340]/10 rounded-xl px-4 py-3 pr-12 text-base text-[#0c2340] placeholder:text-[#0c2340]/50 outline-none focus:border-[#ff6b1a]" />
            <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#0c2340]/50 hover:text-[#0c2340]" aria-label={showPassword ? "Hide password" : "Show password"}>
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {mode === "signin" && (
            <button type="button" onClick={onForgotPassword} disabled={resetLoading} className="text-xs text-primary hover:underline self-end disabled:opacity-60">
              {resetLoading ? "Sending…" : "Forgot password?"}
            </button>
          )}

          {error && <p className="text-destructive text-sm">{error}</p>}
          {info && <p className="text-sm text-emerald-400">{info}</p>}

          <button type="submit" disabled={loading} className="w-full gradient-primary text-[#0F1115] font-bold py-3 rounded-xl glow-orange disabled:opacity-60">
            {loading ? "Please wait..." : mode === "signup" ? "Create shop & send code" : "Sign in"}
          </button>
          <button type="button" onClick={() => navigate({ to: "/" })} className="w-full text-xs text-muted-foreground">← Back to home</button>
        </form>
      )}
    </div>
  );
}
