import { Phone, Send } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { formatPhone } from "@/lib/format";
import { CopyButton } from "./copy-button";
import { ContactCard } from "./contact-card";

/**
 * Vakansiya sahifasida ish beruvchi bilan bog'lanish: e'londagi aloqa telefoni (`simple_vacancy_phone` — ish beruvchi
 * rozilik bergan bo'lsa yoki kompaniya telefoni) — katta "Qo'ng'iroq qilish" tugmasi.
 * Raqam bo'lmasa — kirgan foydalanuvchiga oddiy kontakt kartasi (shaxsiy raqam ruxsat bo'yicha), mehmonga hech narsa.
 */
export async function EmployerCallCard({ phone, companyTelegram, ownerProfileId }: { phone: string | null; companyTelegram: string | null; ownerProfileId: string | null }) {
  const { t } = await getT();
  if (!phone) return ownerProfileId ? <ContactCard profileId={ownerProfileId} /> : null;
  const tg = companyTelegram?.replace(/^@/, "") || null;
  return (
    <div className="space-y-3 rounded-2xl border border-success/30 bg-success-soft/40 p-4">
      <p className="text-sm font-semibold">{t("contacts.employer_title")}</p>
      <a
        href={`tel:${phone.replace(/[^\d+]/g, "")}`}
        className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-success text-base font-semibold text-success-foreground shadow-sm transition-opacity hover:opacity-90"
      >
        <Phone className="size-5" /> {t("contacts.call")}
      </a>
      <div className="flex items-center justify-between gap-2">
        <span className="tabular text-[15px] font-semibold">{formatPhone(phone)}</span>
        <CopyButton value={phone} />
      </div>
      {tg ? (
        <a
          href={`https://t.me/${tg}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-primary/40 bg-card text-[15px] font-semibold text-primary hover:bg-primary-soft/40"
        >
          <Send className="size-4" /> {t("contacts.write_telegram")}
        </a>
      ) : null}
    </div>
  );
}
