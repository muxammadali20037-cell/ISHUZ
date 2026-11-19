"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Dialog as DialogPrimitive } from "radix-ui";
import { Send, X } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { useTelegram } from "@/lib/telegram/provider";
import { DOCUMENT_COOKIE_ATTRS } from "@/lib/security/cookies";
import { Button } from "@/components/ui/button";
import { channelPromptInfo, type ChannelPromptInfo } from "@/features/telegram-channel/prompt-actions";
import { TOUR_DONE_EVENT } from "@/features/tour/steps";

/**
 * Ilovaga har kirganda (brauzer/Telegram sessiyasida bir marta) — "Telegram kanalimizga qo'shiling" oynasi (ega, 2026-11-18:
 * "har kirganda ilovaga Telegram kanalga ulanish tugmasi chiqsin, bossa kanalga olib borsin").
 *  · Kanal havolasi sozlanmagan yoki Telegram orqali kirgan foydalanuvchi kanalda bo'lsa — chiqmaydi (server tekshiradi).
 *  · "Kanalga o'tish" bosilsa — 30 kun so'ralmaydi (ib_channel); "Keyinroq" — keyingi kirishda yana.
 *  · Birinchi ochilishdagi tanishtiruv tugamagan bo'lsa, admin, kirish va ro'yxatdan o'tish sahifalarida — chiqmaydi.
 * Mini App ichida kanal Telegram'ning o'zida ochiladi (openTelegramLink), brauzerda — yangi oynada.
 */
const SEEN_KEY = "ishuz:channel-prompt";
const JOINED_COOKIE = "ib_channel";
const DELAY_MS = 2500;
const SKIP = ["/admin", "/auth", "/onboarding", "/start", "/dev", "/blocked", "/account-deletion"];

let asked = false;

function hasCookie(name: string): boolean {
  return document.cookie.split("; ").some((c) => c.startsWith(`${name}=`));
}

export function ChannelPrompt() {
  const { t } = useT();
  const { webApp } = useTelegram();
  const pathname = usePathname();
  const [info, setInfo] = useState<ChannelPromptInfo | null>(null);
  const current = useRef(pathname);
  const skipped = (p: string | null) => !p || SKIP.some((x) => p === x || p.startsWith(`${x}/`));

  useEffect(() => {
    current.current = pathname;
    if (asked || skipped(pathname)) return;
    // tanishtiruv (birinchi ochilish) hali tugamagan — uning ustiga chiqmaymiz; keyingi sahifada tekshiriladi
    if (!hasCookie("ib_intro")) return;
    asked = true;
    try {
      if (sessionStorage.getItem(SEEN_KEY) || hasCookie(JOINED_COOKIE)) return;
    } catch {
      return;
    }
    // sahifa almashsa ham taymer to'xtamaydi (komponent ildizda); vaqti kelganda yana tekshiriladi
    const show = () => {
      if (skipped(current.current)) {
        asked = false;
        return;
      }
      // birinchi kirgandagi tanishtiruv (app-tour) ochiq — u tugagach chiqamiz, ustma-ust emas
      if (document.documentElement.dataset.tour === "open") {
        window.addEventListener(TOUR_DONE_EVENT, () => window.setTimeout(show, 1200), { once: true });
        return;
      }
      try {
        sessionStorage.setItem(SEEN_KEY, "1");
      } catch {
        /* xususiy rejim — baribir bir marta */
      }
      channelPromptInfo()
        .then((res) => {
          if (res) setInfo(res);
        })
        .catch(() => undefined);
    };
    window.setTimeout(show, DELAY_MS);
  }, [pathname]);

  if (!info) return null;
  const close = () => setInfo(null);
  const join = () => {
    document.cookie = `${JOINED_COOKIE}=1; max-age=${30 * 24 * 3600}${DOCUMENT_COOKIE_ATTRS}`;
    if (webApp?.openTelegramLink) webApp.openTelegramLink(info.href);
    else window.open(info.href, "_blank", "noopener,noreferrer");
    close();
  };

  return (
    <DialogPrimitive.Root open onOpenChange={(open) => (open ? null : close())}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          data-channel-prompt
          // birinchi tugmaga avtomatik fokus (qalin halqa) emas — oynaning o'ziga; Tab bilan tugmalarga o'tiladi
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            (e.currentTarget as HTMLElement | null)?.focus();
          }}
          className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-md rounded-2xl bg-card p-6 text-center shadow-lg data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-bottom-4 data-[state=open]:duration-300 sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2"
          style={{ marginBottom: "var(--safe-bottom)" }}
        >
          <span className="channel-prompt-icon mx-auto flex size-16 items-center justify-center rounded-full" aria-hidden>
            <Send className="size-8 -translate-x-0.5 translate-y-0.5" strokeWidth={2} />
          </span>
          <DialogPrimitive.Title className="mt-4 text-xl font-extrabold leading-tight">{t("easy.channel_prompt.title")}</DialogPrimitive.Title>
          <DialogPrimitive.Description className="mt-2 text-base text-muted-foreground">
            {info.handle ? t("easy.channel_prompt.desc", { handle: info.handle }) : t("easy.channel_prompt.desc_plain")}
          </DialogPrimitive.Description>
          <div className="mt-5 grid gap-2">
            <Button size="lg" className="h-12 w-full text-base" onClick={join} data-track="channel_cta" data-track-to="prompt">
              <Send className="size-5" aria-hidden /> {t("easy.channel_prompt.join")}
            </Button>
            <Button size="lg" variant="ghost" className="h-12 w-full text-base" onClick={close}>
              {t("easy.channel_prompt.later")}
            </Button>
          </div>
          <DialogPrimitive.Close className="tap-target absolute right-3 top-3 rounded-lg p-2 text-muted-foreground hover:bg-secondary" aria-label={t("common.actions.close")}>
            <X className="size-5" />
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
