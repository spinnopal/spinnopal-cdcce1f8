import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { X, Download } from "lucide-react";
import { usePwaInstall } from "@/hooks/use-pwa-install";

const STORAGE_KEY = "mas-spin-install-prompt-dismissed";

export function PwaInstallPrompt() {
  const { deferredPrompt, canInstall, isIOS, hidden } = usePwaInstall();
  const [dismissed, setDismissed] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (hidden) return;
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === "1") setDismissed(true);
    } catch {
      // ignore storage errors
    }
  }, [hidden]);

  // Auto-show the floating banner as soon as the browser signals installability.
  useEffect(() => {
    if (hidden || dismissed) return;
    if (deferredPrompt || isIOS) setVisible(true);
  }, [deferredPrompt, isIOS, hidden, dismissed]);

  if (hidden || dismissed || !visible) return null;

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === "accepted") setVisible(false);
  };

  const handleDismiss = () => {
    setVisible(false);
    setDismissed(true);
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // ignore
    }
  };

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-md rounded-2xl border border-white/10 bg-card/95 p-4 shadow-2xl backdrop-blur-xl">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl gradient-primary">
          <Download className="h-5 w-5 text-primary-foreground" />
        </div>
        <div className="flex-1">
          <p className="font-semibold text-foreground">Install Mas Spin</p>
          <p className="text-sm text-muted-foreground">
            {deferredPrompt
              ? "Add this app to your home screen for the best experience."
              : "Tap the share button in Safari, then choose \"Add to Home Screen\"."}
          </p>
        </div>
        <button
          onClick={handleDismiss}
          aria-label="Dismiss install prompt"
          className="shrink-0 rounded-full p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      {deferredPrompt && (
        <div className="mt-4 flex gap-2">
          <Button onClick={handleInstall} className="flex-1 gradient-primary text-primary-foreground hover:opacity-90">
            Install app
          </Button>
          <Button variant="ghost" onClick={handleDismiss} className="text-muted-foreground">
            Not now
          </Button>
        </div>
      )}
    </div>
  );
}
