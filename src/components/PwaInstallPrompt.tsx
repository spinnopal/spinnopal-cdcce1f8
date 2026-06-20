import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { X, Download } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
  prompt(): Promise<void>;
}

const STORAGE_KEY = "mas-spin-install-prompt-dismissed";

function isPreviewOrDev() {
  if (typeof window === "undefined") return true;
  const host = window.location.hostname;
  return (
    host === "localhost" ||
    host.startsWith("id-preview--") ||
    host.startsWith("preview--") ||
    host === "lovableproject.com" ||
    host.endsWith(".lovableproject.com") ||
    host === "lovableproject-dev.com" ||
    host.endsWith(".lovableproject-dev.com") ||
    host === "beta.lovable.dev" ||
    host.endsWith(".beta.lovable.dev") ||
    window.location.search.includes("sw=off") ||
    window.self !== window.top
  );
}

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as { standalone?: boolean }).standalone === true
  );
}

export function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [visible, setVisible] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    if (isPreviewOrDev()) return;
    if (isStandalone()) return;

    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === "1") {
        setDismissed(true);
      }
    } catch {
      // ignore storage errors
    }

    const iOS =
      /iPad|iPhone|iPod/.test(navigator.userAgent) &&
      !(window as { MSStream?: unknown }).MSStream;
    setIsIOS(iOS);

    const handler = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
      setVisible(true);
    };

    window.addEventListener("beforeinstallprompt", handler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
    };
  }, []);

  if (dismissed || (!visible && !isIOS)) return null;

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === "accepted") {
      setVisible(false);
    }
    setDeferredPrompt(null);
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
