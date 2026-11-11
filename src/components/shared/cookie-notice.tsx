"use client";

import { useSyncExternalStore, useState } from "react";
import Link from "next/link";
import { Cookie } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { DOCUMENT_COOKIE_ATTRS } from "@/lib/security/cookies";

/** Eslatma ko'rilgani: 1 yil (cookie siyosatida yozilgan) */
export const CONSENT_COOKIE = "ib_consent";
const YEAR = 60 * 60 * 24 * 365;

const noop = () => () => {};
const seen = () => {
  try {
    return document.cookie.split("; ").some((c) => c.startsWith(`${CONSENT_COOKIE}=`)) || !!navigator.webdriver;
  } catch {
    return true;
  }
};

/**
 * Cookie eslatmasi (bir marta, pastda, ekranni to'smaydi): zarur cookie'lar rozilik talab qilmaydi, qulaylik cookie'lari
 * foydalanuvchi tanlov qilganda qo'yiladi — shuning uchun bu "ruxsat so'rash" emas, ochiq eslatma va siyosatga havola.
 * Pastki menyu ustida turadi; "Tushunarli" bosilgach 1 yil ko'rinmaydi. Avtomatlashtirilgan brauzerda (testlar) ko'rsatilmaydi.
 */
export function CookieNotice() {
  const { t } = useT();
  // serverda va birinchi chizishda — yo'q (gidratsiya mos keladi); brauzerda cookie tekshiriladi
  const hidden = useSyncExternalStore(noop, seen, () => true);
  const [closed, setClosed] = useState(false);
  if (hidden || closed) return null;
  const accept = () => {
    try {
      document.cookie = `${CONSENT_COOKIE}=1; max-age=${YEAR}${DOCUMENT_COOKIE_ATTRS}`;
    } catch {
      // cookie yozib bo'lmasa — shu sahifada yopiladi
    }
    setClosed(true);
  };
  return (
    <div
      role="region"
      aria-label={t("common.cookies.title")}
      data-cookie-notice
      className="fixed inset-x-0 bottom-[calc(var(--tabbar-height)+var(--safe-bottom))] z-40 px-3 pb-2 md:bottom-4 md:left-auto md:right-4 md:max-w-md md:px-0"
    >
      <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-lg">
        <Cookie className="size-5 shrink-0 text-primary-ink" aria-hidden />
        <p className="min-w-0 flex-1 text-sm leading-snug">
          {t("common.cookies.text")}{" "}
          <Link href="/cookies" className="font-semibold text-primary-ink hover:underline">
            {t("common.cookies.more")}
          </Link>
        </p>
        <button type="button" onClick={accept} className="press inline-flex min-h-11 shrink-0 items-center rounded-md bg-primary px-3.5 text-sm font-bold text-primary-foreground hover:bg-primary-hover">
          {t("common.cookies.ok")}
        </button>
      </div>
    </div>
  );
}
