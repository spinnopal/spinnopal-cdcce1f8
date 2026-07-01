import { useEffect, useState, useCallback } from "react";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
  prompt(): Promise<void>;
}

let capturedDeferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<(prompt: BeforeInstallPromptEvent | null) => void>();

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

function isIOSSafari() {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) && !(window as { MSStream?: unknown }).MSStream;
}

function isInstallablePlatform() {
  return typeof window !== "undefined" && "BeforeInstallPromptEvent" in window;
}

function notifyListeners() {
  listeners.forEach((cb) => cb(capturedDeferredPrompt));
}

function onBeforeInstall(event: Event) {
  event.preventDefault();
  capturedDeferredPrompt = event as BeforeInstallPromptEvent;
  notifyListeners();
}

function onAppInstalled() {
  capturedDeferredPrompt = null;
  notifyListeners();
}

function getInitialPrompt() {
  return capturedDeferredPrompt;
}

export interface PwaInstallState {
  deferredPrompt: BeforeInstallPromptEvent | null;
  canInstall: boolean;
  isIOS: boolean;
  isStandalone: boolean;
  hidden: boolean;
  triggerInstall: () => Promise<{ outcome: "accepted" | "dismissed" | "unsupported" | "unavailable"; platform?: string }>;
}

export function usePwaInstall(): PwaInstallState {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(getInitialPrompt);
  const [hidden] = useState(() => isPreviewOrDev() || isStandalone());
  const [isIOS] = useState(() => isIOSSafari());
  const canInstall = !hidden && (deferredPrompt !== null || isIOS || isInstallablePlatform());

  useEffect(() => {
    if (hidden) return;

    const listener = (prompt: BeforeInstallPromptEvent | null) => setDeferredPrompt(prompt);
    listeners.add(listener);
    if (deferredPrompt !== capturedDeferredPrompt) {
      setDeferredPrompt(capturedDeferredPrompt);
    }

    if (!capturedDeferredPrompt) {
      window.addEventListener("beforeinstallprompt", onBeforeInstall);
    }

    return () => {
      listeners.delete(listener);
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
    };
  }, [hidden, deferredPrompt]);

  const triggerInstall = useCallback(async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") {
        capturedDeferredPrompt = null;
        notifyListeners();
      }
      return { outcome: choice.outcome, platform: choice.platform };
    }
    if (isIOS) return { outcome: "unsupported" as const };
    return { outcome: "unavailable" as const };
  }, [deferredPrompt, isIOS]);

  return {
    deferredPrompt,
    canInstall,
    isIOS,
    isStandalone: !hidden && isStandalone(),
    hidden,
    triggerInstall,
  };
}
