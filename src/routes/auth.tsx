import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Eye, EyeOff, CheckCircle2, Clock, XCircle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { isValidEmail } from "@/lib/validation";
import { DEFAULT_LOGO } from "@/lib/spin-store";
import { submitSignupRequest, getSignupRequestStatus } from "@/lib/pending-signups.functions";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Lucky Spin" },
      { name: "description", content: "Create a shop or sign in to manage your Lucky Spin campaign." },
    ],
  }),
  component: AuthPage,
});

type Step = "form" | "submitted";

function AuthPage() {
  const navigate = useNavigate();
  const submitRequest = useServerFn(submitSignupRequest);
  const checkStatus = useServerFn(getSignupRequestStatus);

  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [step, setStep] = useState<Step>("form");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [shopName, setShopName] = useState("");
  const [slug, setSlug] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [requestStatus, setRequestStatus] = useState<null | {
    status: "pending" | "approved" | "rejected";
    review_notes: string | null;
    reviewed_at: string | null;
    created_at: string;
  }>(null);

  const onForgotPassword = async () => {
    setError(""); setInfo("");
    if (!isValidEmail(email)) { setError("Enter your email above, then tap Forgot password"); return; }
    setResetLoading(true);
    try {
      const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (err) throw err;
      try { sessionStorage.setItem("reset_email", email); } catch {}
      setInfo("We sent a reset link to your email.");
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
    setError(""); setInfo(""); setLoading(true);
    try {
      if (!isValidEmail(email)) throw new Error("Please enter a valid email address");
      if (!password || password.length < 6) throw new Error("Password must be at least 6 characters");

      if (mode === "signup") {
        const desiredSlug = slug || autoSlug(shopName);
        if (!shopName.trim()) throw new Error("Shop name is required");
        if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(desiredSlug))
          throw new Error("Shop URL can only contain lowercase letters, numbers and dashes");

        await submitRequest({ data: { shop_name: shopName.trim(), slug: desiredSlug, email, password } });
        setStep("submitted");
      } else {
        const { error: e1 } = await supabase.auth.signInWithPassword({ email, password });
        if (e1) {
          // If their sign-in failed, check whether they have a pending/rejected request
          try {
            const res = await checkStatus({ data: { email } });
            if (res.request) {
              setRequestStatus(res.request as typeof requestStatus);
              setStep("submitted");
              return;
            }
          } catch {/* ignore */}
          throw e1;
        }
        navigate({ to: "/dashboard" });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  if (step === "submitted") {
    const status = requestStatus?.status ?? "pending";
    const icon = status === "pending"
      ? <Clock className="text-amber-500" size={48} />
      : status === "approved"
        ? <CheckCircle2 className="text-emerald-500" size={48} />
        : <XCircle className="text-red-500" size={48} />;

    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 py-10">
        <img src={DEFAULT_LOGO} alt="" className="w-20 h-20 rounded-full object-cover mb-4 opacity-90" />
        <h1 className="text-2xl font-black tracking-wider mb-1">LUCKY SPIN</h1>
        <p className="text-xs tracking-[0.3em] text-gold uppercase mb-8">Shop Owner Portal</p>

        <div className="glass rounded-2xl p-6 w-full max-w-sm text-center space-y-4">
          <div className="flex justify-center">{icon}</div>

          {status === "pending" && (
            <>
              <h2 className="text-lg font-bold text-[#0c2340]">Request submitted</h2>
              <p className="text-sm text-[#0c2340]/70">
                Thanks! Your shop signup request for <strong>{email}</strong> is waiting for admin review.
                You'll receive an email once it's approved — usually within 24 hours.
              </p>
            </>
          )}

          {status === "approved" && (
            <>
              <h2 className="text-lg font-bold text-[#0c2340]">You're approved!</h2>
              <p className="text-sm text-[#0c2340]/70">Your account is active. Sign in with your password to continue.</p>
              <button
                onClick={() => { setStep("form"); setMode("signin"); setRequestStatus(null); }}
                className="w-full gradient-primary text-[#0F1115] font-bold py-3 rounded-xl glow-orange"
              >Sign in</button>
            </>
          )}

          {status === "rejected" && (
            <>
              <h2 className="text-lg font-bold text-[#0c2340]">Request declined</h2>
              <p className="text-sm text-[#0c2340]/70">
                Unfortunately your signup request was declined.
                {requestStatus?.review_notes ? <><br /><span className="block mt-2 italic">"{requestStatus.review_notes}"</span></> : null}
              </p>
              <p className="text-xs text-[#0c2340]/60">Questions? Contact us at theluckspin@gmail.com</p>
            </>
          )}

          <button
            onClick={() => { setStep("form"); setRequestStatus(null); }}
            className="w-full text-xs text-muted-foreground"
          >← Back</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-10">
      <img src={DEFAULT_LOGO} alt="" className="w-20 h-20 rounded-full object-cover mb-4 opacity-90" />
      <h1 className="text-2xl font-black tracking-wider mb-1">LUCKY SPIN</h1>
      <p className="text-xs tracking-[0.3em] text-gold uppercase mb-8">Shop Owner Portal</p>

      <form onSubmit={onSubmit} onInput={() => { interactedRef.current = true; }} className="glass rounded-2xl p-5 w-full max-w-sm space-y-3">
        <div className="flex gap-2 mb-1">
          <button type="button" onClick={() => setMode("signup")} className={`flex-1 py-2 rounded-lg text-sm font-semibold ${mode === "signup" ? "gradient-primary text-[#0c2340]" : "bg-[#0c2340]/10 text-[#0c2340]/70"}`}>Request shop</button>
          <button type="button" onClick={() => setMode("signin")} className={`flex-1 py-2 rounded-lg text-sm font-semibold ${mode === "signin" ? "gradient-primary text-[#0c2340]" : "bg-[#0c2340]/10 text-[#0c2340]/70"}`}>Sign in</button>
        </div>

        {mode === "signup" && (
          <>
            <p className="text-xs text-[#0c2340]/70 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
              <strong>Admin approval required.</strong> We review every new shop before activation to keep the platform safe.
            </p>
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

        <button type="submit" disabled={loading} className="w-full gradient-primary text-[#0F1115] font-bold py-3 rounded-xl glow-orange disabled:opacity-60 flex items-center justify-center gap-2">
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          {loading ? "Please wait..." : mode === "signup" ? "Submit signup request" : "Sign in"}
        </button>
        <button type="button" onClick={() => navigate({ to: "/" })} className="w-full text-xs text-muted-foreground">← Back to home</button>
      </form>
    </div>
  );
}
