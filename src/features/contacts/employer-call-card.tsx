import Link from "next/link";
import { LogIn, Phone, Send } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { formatPhone } from "@/lib/format";
import { CopyButton } from "./copy-button";
import { ContactCard } from "./contact-card";

/** Telegram foydalanuvchi nomi: "@name", "t.me/name" yoki "https://t.me/name" → "name" (faqat ruxsat etilgan belgilar) */
export function telegramUsername(raw: string | null | undefined): string | null {
  const m = raw?.trim().match(/^(?:@|(?:https?:\/\/)?t\.me\/)?([A-Za-z][A-Za-z0-9_]{3,31})\/?$/);
  return m ? m[1]! : null;
}

/**
 * Vakansiya sahifasida ish beruvchi bilan bog'lanish: e'londagi aloqa telefoni (`simple_vacancy_phone` — ish beruvchi
 * rozilik bergan bo'lsa yoki kompaniya telefoni) — katta "Qo'ng'iroq qilish" tugmasi; kompaniya Telegram'i bo'lsa —
 * "Telegram'da yozish" (telefon bo'lmasa ham — 2026-10-31 auditi: avval faqat telefon bilan birga chiqardi).
 * Ikkalasi ham bo'lmasa — kirgan foydalanuvchiga oddiy kontakt kartasi (shaxsiy raqam ruxsat bo'yicha).
 * Mehmon (`guestNext` berilgan): 0074 dan beri telefon faqat kirganlarga ochiladi — "kirish" taklifi (raqam bor-yo'qligini
 * oshkor qilmaydi).
 * `data-contact` — aloqa niyati statistikasi uchun (AnalyticsListener).
 */
export async function EmployerCallCard({
  phone,
  companyTelegram,
  ownerProfileId,
  guestNext,
}: {
  phone: string | null;
  companyTelegram: string | null;
  ownerProfileId: string | null;
  guestNext?: string | null;
}) {
  const { t } = await getT();
  const tg = telegramUsername(companyTelegram);
  const guest = guestNext ? (
    <div className="space-y-2" data-contact-guest>
      <p className="text-base">{t("contacts.guest_hint")}</p>
      <Link
        href={`/auth?next=${encodeURIComponent(guestNext)}`}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-primary/40 bg-card text-md font-semibold text-primary hover:bg-primary-soft/40"
      >
        <LogIn className="size-4" aria-hidden /> {t("contacts.guest_login")}
      </Link>
    </div>
  ) : null;
  if (!phone && !tg) {
    if (ownerProfileId) return <ContactCard profileId={ownerProfileId} />;
    if (!guest) return null;
    return (
      <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
        <p className="text-sm font-semibold">{t("contacts.employer_title")}</p>
        {guest}
      </div>
    );
  }
  return (
    <div className="space-y-3 rounded-2xl border border-success/30 bg-success-soft/40 p-4">
      <p className="text-sm font-semibold">{t("contacts.employer_title")}</p>
      {phone ? (
        <>
          <a
            href={`tel:${phone.replace(/[^\d+]/g, "")}`}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-success text-base font-semibold text-success-foreground shadow-sm transition-opacity hover:opacity-90"
          >
            <Phone className="size-5" /> {t("contacts.call")}
          </a>
          <div className="flex items-center justify-between gap-2">
            <span className="tabular text-md font-semibold">{formatPhone(phone)}</span>
            <CopyButton value={phone} />
          </div>
        </>
      ) : null}
      {tg ? (
        <a
          href={`https://t.me/${tg}`}
          target="_blank"
          rel="noopener noreferrer"
          data-contact="telegram"
          className={
            phone
              ? "flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-primary/40 bg-card text-md font-semibold text-primary hover:bg-primary-soft/40"
              : "flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-base font-semibold text-primary-foreground shadow-sm hover:bg-primary-hover"
          }
        >
          <Send className="size-4" /> {t("contacts.write_telegram")}
        </a>
      ) : null}
      {!phone ? guest : null}
    </div>
  );
}
