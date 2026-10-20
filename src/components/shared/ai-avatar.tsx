import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * AI yordamchining yagona belgisi (hamma joyda bir xil): ko'k plita + uchqun. `busy` — o'ylayapti: atrofida yumshoq halqa
 * (globals.css → .ai-orb; prefers-reduced-motion'da harakatsiz). Bezak: ekran o'qigichdan yashirin.
 */
export function AiAvatar({ busy = false, size = "md", className }: { busy?: boolean; size?: "sm" | "md" | "lg"; className?: string }) {
  return (
    <span
      aria-hidden
      data-busy={busy || undefined}
      className={cn(
        "ai-orb flex shrink-0 items-center justify-center bg-primary text-primary-foreground",
        size === "sm" ? "size-7 rounded-lg" : size === "lg" ? "size-12 rounded-2xl" : "size-9 rounded-xl",
        className,
      )}
    >
      <Sparkles className={size === "sm" ? "size-4" : size === "lg" ? "size-6" : "size-5"} />
    </span>
  );
}
