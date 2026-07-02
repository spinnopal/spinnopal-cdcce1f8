import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Download, Share2, Smartphone, Check, MoreVertical, Plus } from "lucide-react";
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
  const { deferredPrompt, isIOS, isStandalone, hidden } = usePwaInstall();
  const [open, setOpen] = useState(false);
  const [installed, setInstalled] = useState(false);

  // Only truly hide if we're inside preview iframe or already running as an installed app.
  if (hidden || isStandalone || installed) return null;

  const canPromptNow = deferredPrompt !== null;

  const handleClick = async () => {
    if (canPromptNow && deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === "accepted") {
          setInstalled(true);
          return;
        }
      } catch {
        // fall through to instructions
      }
      setOpen(true);
      return;
    }
    // No native prompt available — show manual instructions.
    setOpen(true);
  };

  const label = canPromptNow ? "Install app" : isIOS ? "Add to Home Screen" : "Install app";
  const Icon = canPromptNow ? Download : isIOS ? Share2 : Smartphone;

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={handleClick}
        className={className}
        aria-label={label}
      >
        <Icon className="h-4 w-4" />
        {showLabel && <span>{label}</span>}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Install Spinnopal</DialogTitle>
            <DialogDescription>
              Add the app to your home screen for a full-screen, app-like experience.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-2 space-y-5">
            <section>
              <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <Smartphone className="h-4 w-4" /> Android (Chrome / Edge)
              </h3>
              <ol className="space-y-2 text-sm text-muted-foreground">
                <li className="flex gap-2">
                  <span className="font-semibold text-foreground">1.</span>
                  <span>
                    Tap the menu <MoreVertical className="inline h-3.5 w-3.5" /> in the top-right of
                    your browser.
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="font-semibold text-foreground">2.</span>
                  <span>Choose <b>Install app</b> or <b>Add to Home screen</b>.</span>
                </li>
                <li className="flex gap-2">
                  <span className="font-semibold text-foreground">3.</span>
                  <span>Confirm <b>Install</b>. The app icon will appear on your home screen.</span>
                </li>
              </ol>
            </section>

            <section>
              <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <Share2 className="h-4 w-4" /> iPhone / iPad (Safari)
              </h3>
              <ol className="space-y-2 text-sm text-muted-foreground">
                <li className="flex gap-2">
                  <span className="font-semibold text-foreground">1.</span>
                  <span>
                    Tap the <b>Share</b> button <Share2 className="inline h-3.5 w-3.5" /> at the
                    bottom of Safari.
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="font-semibold text-foreground">2.</span>
                  <span>
                    Scroll and tap <b>Add to Home Screen</b>{" "}
                    <Plus className="inline h-3.5 w-3.5" />.
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="font-semibold text-foreground">3.</span>
                  <span>
                    Tap <b>Add</b> in the top-right. The app appears on your home screen.
                  </span>
                </li>
              </ol>
              <p className="mt-2 text-xs text-muted-foreground">
                Note: iPhone install only works in <b>Safari</b>, not Chrome or in-app browsers.
              </p>
            </section>

            {canPromptNow && (
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm">
                <p className="flex items-center gap-2 font-medium">
                  <Check className="h-4 w-4 text-primary" /> Your browser supports one-tap install.
                </p>
                <Button
                  onClick={handleClick}
                  className="mt-2 w-full"
                  size="sm"
                >
                  <Download className="h-4 w-4" /> Install now
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
