import { useEffect, useState } from "react";

const STORAGE_KEY = "spinnopal-reduced-motion";

export function useReducedMotion() {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === null) {
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      setReducedMotion(mq.matches);
      const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    } else {
      setReducedMotion(stored === "true");
    }
  }, []);

  const set = (value: boolean) => {
    setReducedMotion(value);
    localStorage.setItem(STORAGE_KEY, String(value));
  };

  return [reducedMotion, set] as const;
}
