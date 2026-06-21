import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_LOGO } from "@/lib/spin-store";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Reset password — Lucky Spin" },
      { name: "description", content: "Set a new password for your Lucky Spin shop owner account." },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // When the user clicks the recovery link, Supabase puts tokens in the URL hash
    // and emits a PASSWORD_RECOVERY event. We wait for a valid session before allowing update.
    let active = true;
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) {
        setReady(true);
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      if (active && data.session) setReady(true);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setInfo("");
    if (password.length < 6) return setError("Password must be at least 6 characters");
    if (password !== confirm) return setError("Passwords do not match");
    setLoading(true);
    try {
      const { error: err } = await supabase.auth.updateUser({ password });
      if (err) throw err;
      setInfo("Password updated. Redirecting…");
      setTimeout(() => navigate({ to: "/dashboard" }), 800);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-10">
      <img src={DEFAULT_LOGO} alt="" className="w-20 h-20 rounded-full object-cover mb-4 opacity-90" />
      <h1 className="text-2xl font-black tracking-wider mb-1">LUCKY SPIN</h1>
      <p className="text-xs tracking-[0.3em] text-gold uppercase mb-8">Reset password</p>

      <form onSubmit={onSubmit} className="glass rounded-2xl p-5 w-full max-w-sm space-y-3">
        {!ready ? (
          <p className="text-sm text-muted-foreground">
            Open the password reset link from your email to continue. If you arrived here directly, request a new link from the sign-in page.
          </p>
        ) : (
          <>
            <label className="text-xs uppercase tracking-widest text-muted-foreground">New password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
                className="w-full bg-[#0F1115]/70 border border-white/10 rounded-xl px-4 py-3 pr-12 outline-none focus:border-primary"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <label className="text-xs uppercase tracking-widest text-muted-foreground">Confirm password</label>
            <input
              type={showPassword ? "text" : "password"}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
              className="w-full bg-[#0F1115]/70 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-primary"
            />
          </>
        )}

        {error && <p className="text-destructive text-sm">{error}</p>}
        {info && <p className="text-sm text-emerald-400">{info}</p>}

        {ready && (
          <button
            type="submit"
            disabled={loading}
            className="w-full gradient-primary text-[#0F1115] font-bold py-3 rounded-xl glow-orange disabled:opacity-60"
          >
            {loading ? "Updating…" : "Update password"}
          </button>
        )}
        <button
          type="button"
          onClick={() => navigate({ to: "/auth" })}
          className="w-full text-xs text-muted-foreground"
        >
          ← Back to sign in
        </button>
      </form>
    </div>
  );
}
