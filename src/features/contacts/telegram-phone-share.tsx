"use client";

import { useState } from "react";
import { Phone } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { useTelegram } from "@/lib/telegram/provider";
import { Button } from "@/components/ui/button";
import { getMyPhone } from "./actions";

/**
 * "Raqamni ulashish" — Telegram ichida bitta tugma: Telegram raqamni botga yuboradi (Telegram tasdiqlagan, SMS kod yo'q),
 * webhook uni profilga yozadi, bu komponent esa raqam paydo bo'lguncha kutadi.
 * Telegram tashqarisida yoki eski Telegram versiyasida — hech narsa ko'rsatmaydi (o'rniga oddiy usul ishlatiladi).
 */
export function TelegramPhoneShare({ onShared, className }: { onShared: (phone: string) => void; className?: string }) {
  const { t } = useT();
  const { webApp, notify } = useTelegram();
  const [state, setState] = useState<"idle" | "waiting" | "failed">("idle");
  if (!webApp?.requestContact) return null;

  const share = () => {
    setState("waiting");
    webApp.requestContact?.((shared) => {
      if (!shared) {
        setState("idle");
        return;
      }
      // Webhook raqamni yozguncha bir necha soniya kutamiz
      let tries = 0;
      const poll = async () => {
        const phone = await getMyPhone().catch(() => null);
        if (phone) {
          notify("success");
          setState("idle");
          onShared(phone);
          return;
        }
        if (++tries < 15) window.setTimeout(poll, 1200);
        else setState("failed");
      };
      void poll();
    });
  };

  return (
    <div className={className}>
      <Button type="button" size="lg" className="h-14 w-full text-base" onClick={share} loading={state === "waiting"}>
        <Phone className="size-5" /> {t("contacts.share.button")}
      </Button>
      <p className="mt-2 text-center text-xs text-muted-foreground">{state === "failed" ? t("contacts.share.failed") : t("contacts.share.hint")}</p>
    </div>
  );
}
