import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { createShop, listMyShops } from "@/lib/shops.functions";
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

function AuthPage() {
  const navigate = useNavigate();
  const create = useServerFn(createShop);
  const listShops = useServerFn(listMyShops);

  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [shopName, setShopName] = useState("");
  const [slug, setSlug] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard" });
    });
  }, [navigate]);

  const autoSlug = (s: string) =>
    s
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (mode === "signup") {
        const desiredSlug = slug || autoSlug(shopName);
        if (!shopName.trim()) throw new Error("Shop name is required");
        if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(desiredSlug))
          throw new Error("Shop URL can only contain lowercase letters, numbers and dashes");

        const { error: signUpErr } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/dashboard` },
        });
        if (signUpErr) throw signUpErr;

        // Auto-confirm flow may already give a session; otherwise sign in.
        let sess = (await supabase.auth.getSession()).data.session;
        if (!sess) {
          const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
          if (signInErr) throw signInErr;
          sess = (await supabase.auth.getSession()).data.session;
        }
        if (!sess) {
          setError("Account created. Please check your email to confirm, then sign in.");
          setMode("signin");
          return;
        }
        await create({ data: { name: shopName.trim(), slug: desiredSlug } });
        navigate({ to: "/dashboard" });
      } else {
        const { error: e1 } = await supabase.auth.signInWithPassword({ email, password });
        if (e1) throw e1;
        // If they signed in but have no shop yet (e.g. confirmed later), send them to dashboard which will prompt.
        const res = await listShops();
        if (res.shops.length === 0) {
          navigate({ to: "/dashboard" });
        } else {
          navigate({ to: "/dashboard" });
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-10">
      <img src={DEFAULT_LOGO} alt="" className="w-20 h-20 rounded-full object-cover mb-4 opacity-90" />
      <h1 className="text-2xl font-black tracking-wider mb-1">LUCKY SPIN</h1>
      <p className="text-xs tracking-[0.3em] text-gold uppercase mb-8">Shop Owner Portal</p>

      <form onSubmit={onSubmit} className="glass rounded-2xl p-5 w-full max-w-sm space-y-3">
        <div className="flex gap-2 mb-1">
          <button
            type="button"
            onClick={() => setMode("signup")}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold ${mode === "signup" ? "bg-primary text-[#0F1115]" : "bg-white/5 text-muted-foreground"}`}
          >
            Create shop
          </button>
          <button
            type="button"
            onClick={() => setMode("signin")}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold ${mode === "signin" ? "bg-primary text-[#0F1115]" : "bg-white/5 text-muted-foreground"}`}
          >
            Sign in
          </button>
        </div>

        {mode === "signup" && (
          <>
            <label className="text-xs uppercase tracking-widest text-muted-foreground">Shop name</label>
            <input
              value={shopName}
              onChange={(e) => {
                setShopName(e.target.value);
                if (!slug) setSlug(autoSlug(e.target.value));
              }}
              placeholder="My Mobile Shop"
              maxLength={80}
              className="w-full bg-[#0F1115]/70 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-primary"
            />
            <label className="text-xs uppercase tracking-widest text-muted-foreground">Shop URL</label>
            <div className="flex items-center bg-[#0F1115]/70 border border-white/10 rounded-xl px-4 py-3">
              <span className="text-muted-foreground text-sm mr-1">/s/</span>
              <input
                value={slug}
                onChange={(e) => setSlug(autoSlug(e.target.value))}
                placeholder="my-mobile-shop"
                maxLength={40}
                className="flex-1 bg-transparent outline-none"
              />
            </div>
          </>
        )}

        <label className="text-xs uppercase tracking-widest text-muted-foreground">Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          className="w-full bg-[#0F1115]/70 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-primary"
        />
        <label className="text-xs uppercase tracking-widest text-muted-foreground">Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          className="w-full bg-[#0F1115]/70 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-primary"
        />

        {error && <p className="text-destructive text-sm">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full gradient-primary text-[#0F1115] font-bold py-3 rounded-xl glow-orange disabled:opacity-60"
        >
          {loading ? "Please wait..." : mode === "signup" ? "Create shop & sign in" : "Sign in"}
        </button>
        <button
          type="button"
          onClick={() => navigate({ to: "/" })}
          className="w-full text-xs text-muted-foreground"
        >
          ← Back to home
        </button>
      </form>
    </div>
  );
}
