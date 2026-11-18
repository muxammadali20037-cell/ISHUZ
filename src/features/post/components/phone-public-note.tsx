"use client";

import { Eye } from "lucide-react";
import { useT } from "@/lib/i18n/client";

/**
 * E'lon berishda: raqam majburiy va hammaga ko'rinadi (ega, 2026-11-18: "telefon raqam hammaga ko'rinsin, e'lon
 * joylayotganda kiritish majburiy"). Avvalgi "raqamim ko'rinsin" belgisi o'rnida — tanlov emas, ochiq ogohlantirish:
 * vakansiyada raqam Telegram kanaldagi postda ham chiqadi, ishchi e'lonida — faqat saytda (kanalda ism/raqam yo'q).
 */
export function PhonePublicNote({ kind }: { kind: "vacancy" | "worker" }) {
  const { t } = useT();
  return (
    <div data-phone-public={kind} className="flex gap-3 rounded-2xl border border-primary/30 bg-primary-soft/50 p-4">
      <Eye className="mt-0.5 size-5 shrink-0 text-primary-ink" aria-hidden />
      <div>
        <p className="text-base font-bold">{t("easy.phone_public.title")}</p>
        <p className="mt-0.5 text-base text-muted-foreground">{t(kind === "vacancy" ? "easy.phone_public.vacancy" : "easy.phone_public.worker")}</p>
      </div>
    </div>
  );
}
