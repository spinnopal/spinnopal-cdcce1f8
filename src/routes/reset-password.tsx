import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { isValidEmail } from "@/lib/validation";
import { DEFAULT_LOGO } from "@/lib/spin-store";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Reset password — Mystery Unlock" },
      { name: "description", content: "Set a new password for your Mystery Unlock shop owner account." },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  // If the user arrives via the magic-link in the email, Supabase will create
  // a recovery session automatically. In that case we skip the code step.
  const [hasRecoverySession, setHasRecoverySession] = useState(false);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [verified, setVerified] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let active = true;
    try {
      const stashed = sessionStorage.getItem("reset_email");
      if (stashed) setEmail(stashed);
    } catch {}
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) {
        setHasRecoverySession(true);
        setVerified(true);
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      if (active && data.session) { setHasRecoverySession(true); setVerified(true); }
    });
    return () => { active = false; sub.subscription.unsubscribe(); };
  }, []);

  const sendCode = async () => {
    setError(""); setInfo("");
    if (!isValidEmail(email)) { setError("Enter a valid email"); return; }
    setSending(true);
    try {
      const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (err) throw err;
      try { sessionStorage.setItem("reset_email", email); } catch {}
      setInfo("We sent a 6-digit code to your email.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send code");
    } finally { setSending(false); }
  };

  const verifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setInfo("");
    const token = code.replace(/\s+/g, "");
    if (!isValidEmail(email)) { setError("Enter your email"); return; }
    if (!/^\d{6}$/.test(token)) { setError("Enter the 6-digit code"); return; }
    setLoading(true);
    try {
      const { error: verr } = await supabase.auth.verifyOtp({ email, token, type: "recovery" });
      if (verr) throw verr;
      setVerified(true);
      setInfo("Code verified. Set your new password below.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid or expired code");
    } finally { setLoading(false); }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setInfo("");
    if (password.length < 6) return setError("Password must be at least 6 characters");
    if (password !== confirm) return setError("Passwords do not match");
    setLoading(true);
    try {
      const { error: err } = await supabase.auth.updateUser({ password });
      if (err) throw err;
      try { sessionStorage.removeItem("reset_email"); } catch {}
      setInfo("Password updated. Redirecting…");
      setTimeout(() => navigate({ to: "/dashboard" }), 800);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update password");
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-10">
      <img src={DEFAULT_LOGO} alt="" className="w-20 h-20 rounded-full object-cover mb-4 opacity-90" />
      <h1 className="text-2xl font-black tracking-wider mb-1">MYSTERY UNLOCK</h1>
      <p className="text-xs tracking-[0.3em] text-gold uppercase mb-8">Reset password</p>

      <div className="glass rounded-2xl p-5 w-full max-w-sm space-y-3">
        {!verified && !hasRecoverySession && (
          <form onSubmit={verifyCode} className="space-y-3">
            <p className="text-sm text-muted-foreground">Enter the email you used to sign up, request a code, then paste the 6-digit code we email you.</p>
            <label className="text-xs uppercase tracking-widest text-muted-foreground">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" className="w-full bg-[#F5F7FA] border border-[#0c2340]/10 rounded-xl px-4 py-3 text-base text-[#0c2340] outline-none focus:border-[#ff6b1a]" />
            <button type="button" onClick={sendCode} disabled={sending} className="w-full text-sm font-semibold py-2 rounded-xl bg-[#0c2340]/10 text-[#0c2340] disabled:opacity-60">
              {sending ? "Sending…" : "Send code"}
            </button>
            <label className="text-xs uppercase tracking-widest text-muted-foreground">Verification code</label>
            <input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} placeholder="123456" className="w-full bg-[#F5F7FA] border border-[#0c2340]/10 rounded-xl px-4 py-3 text-center tracking-[0.5em] text-xl text-[#0c2340] outline-none focus:border-[#ff6b1a]" />
            {error && <p className="text-destructive text-sm">{error}</p>}
            {info && <p className="text-sm text-emerald-400">{info}</p>}
            <button type="submit" disabled={loading} className="w-full gradient-primary text-[#0F1115] font-bold py-3 rounded-xl glow-orange disabled:opacity-60">
              {loading ? "Verifying…" : "Verify code"}
            </button>
          </form>
        )}

        {verified && (
          <form onSubmit={onSubmit} className="space-y-3">
            <label className="text-xs uppercase tracking-widest text-muted-foreground">New password</label>
            <div className="relative">
              <input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} autoComplete="new-password" className="w-full bg-[#F5F7FA] border border-[#0c2340]/10 rounded-xl px-4 py-3 pr-12 text-base text-[#0c2340] outline-none focus:border-[#ff6b1a]" />
              <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#0c2340]/50 hover:text-[#0c2340]" aria-label={showPassword ? "Hide password" : "Show password"}>
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <label className="text-xs uppercase tracking-widest text-muted-foreground">Confirm password</label>
            <input type={showPassword ? "text" : "password"} value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={6} autoComplete="new-password" className="w-full bg-[#F5F7FA] border border-[#0c2340]/10 rounded-xl px-4 py-3 text-base text-[#0c2340] outline-none focus:border-[#ff6b1a]" />
            {error && <p className="text-destructive text-sm">{error}</p>}
            {info && <p className="text-sm text-emerald-400">{info}</p>}
            <button type="submit" disabled={loading} className="w-full gradient-primary text-[#0F1115] font-bold py-3 rounded-xl glow-orange disabled:opacity-60">
              {loading ? "Updating…" : "Update password"}
            </button>
          </form>
        )}

        <button type="button" onClick={() => navigate({ to: "/auth" })} className="w-full text-xs text-muted-foreground">← Back to sign in</button>
      </div>
    </div>
  );
}
