import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Share2, Home, Smartphone } from "lucide-react";
import { usePwaInstall } from "@/hooks/use-pwa-install";

interface InstallAppButtonProps {
  variant?: "default" | "outline" | "ghost" | "secondary";
  size?: "default" | "sm" | "lg";
  className?: string;
  showLabel?: boolean;
}

export function InstallAppButton({
  variant = "default",
  size = "default",
  className,
  showLabel = true,
}: InstallAppButtonProps) {
  const { deferredPrompt, canInstall, isIOS, hidden } = usePwaInstall();
  const [hint, setHint] = useState<string | null>(null);

  if (hidden) return null;
  if (!canInstall && !isIOS) return null;

  const handleClick = async () => {
    setHint(null);
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      return;
    }
    if (isIOS) {
      setHint("Tap the share button in Safari, then choose \"Add to Home Screen\".");
      return;
    }
    setHint("Tap your browser menu (⋮) and choose \"Add to Home Screen\" or \"Install app\".");
  };

  const label = deferredPrompt
    ? "Install app"
    : isIOS
      ? "Add to Home Screen"
      : "Install app";

  const Icon = deferredPrompt ? Download : isIOS ? Share2 : Smartphone;

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <Button
        variant={variant}
        size={size}
        onClick={handleClick}
        className={className}
      >
        <Icon className="h-4 w-4" />
        {showLabel && <span>{label}</span>}
      </Button>
      {hint && (
        <p className="max-w-[260px] text-xs text-muted-foreground bg-card/90 border border-white/10 rounded-lg px-3 py-2 shadow-lg">
          <Home className="inline h-3 w-3 mr-1" />
          {hint}
        </p>
      )}
    </div>
  );
}
