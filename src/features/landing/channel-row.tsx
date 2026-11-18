"use client";

import { ChevronRight, Send } from "lucide-react";
import { useTelegram } from "@/lib/telegram/provider";
import { cn } from "@/lib/utils";

/**
 * "Telegram kanalimizga obuna bo'ling" qatori (ega, 2026-11-18: "1-o'rinda Telegram mini app va kanal — obunachi va
 * foydalanuvchi yig'ishimiz kerak"). Havola — Vercel'dagi SOCIAL_TELEGRAM_URL (sozlanmagan bo'lsa qator chiqmaydi).
 * Mini App ichida Telegram'ning o'zida ochiladi (openTelegramLink), brauzerda — yangi oynada. Rangsiz, boshqa qatorlardek.
 */
export function ChannelRow({ href, title, hint, className }: { href: string; title: string; hint: string; className?: string }) {
  const { webApp } = useTelegram();
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      data-channel-row
      data-track="channel_cta"
      data-track-to="home"
      onClick={(e) => {
        if (webApp?.openTelegramLink) {
          e.preventDefault();
          webApp.openTelegramLink(href);
        }
      }}
      className={cn("press flex min-h-16 items-center gap-3 rounded-2xl border border-border/70 bg-card px-4 py-2.5 shadow-sm hover:bg-secondary/60", className)}
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-foreground" aria-hidden>
        <Send className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-base font-bold leading-tight">{title}</span>
        <span className="mt-0.5 block text-sm leading-snug text-muted-foreground">{hint}</span>
      </span>
      <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
    </a>
  );
}
