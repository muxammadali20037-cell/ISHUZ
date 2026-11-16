import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import { BRAND } from "@/config/brand";
import { BrandLogo } from "@/components/shared/brand-logo";
import { getEntryMedia } from "../queries";
import { EntryImage } from "./entry-art";
import { EntryScreen } from "./entry-screen";
import { WelcomeLanguage } from "./welcome-language";

/**
 * 02 · Welcome (4.0, 2026-11-16, ega "MASTER PROMPT"): haqiqiy surat (admin "home_photo" joyiga yuklaydi; bo'lmasa — egasi
 * bergan surat), sarlavha va izoh, ikkita katta tugma:
 *  - "Boshlash" → 04 rol tanlash (/start/rol?from=welcome) — kirish talab qilinmaydi (e'lon yoki ariza paytida so'raladi);
 *  - "Hisobim mavjud" → kirish (/auth).
 * Til — tepada ixcham qator (bosilsa darhol shu tilga o'tadi; JS'siz — ?lang= havolasi). "Qanday ishlaydi?" — tepada o'ngda.
 */
export async function WelcomeScreen({ error = false, next = null }: { error?: boolean; next?: string | null }) {
  const [{ t, locale }, media] = await Promise.all([getT(), getEntryMedia()]);
  const startHref = `/start/rol?${new URLSearchParams({ from: "welcome", ...(next ? { next } : {}) }).toString()}`;
  return (
    <EntryScreen
      left={<BrandLogo className="px-3 text-lg" label={BRAND.name} />}
      right={
        <Link href="/start/tanishtiruv?next=%2Fstart%2Ftil" className="inline-flex min-h-11 items-center px-3 text-sm font-semibold text-primary-ink hover:underline">
          {t("welcome.entry.welcome.how")}
        </Link>
      }
      footer={
        <div className="grid gap-3" data-welcome-actions>
          <Link
            href={startHref}
            data-testid="welcome-start"
            className="press inline-flex h-14 w-full items-center justify-center rounded-2xl bg-primary px-6 text-base font-bold text-primary-foreground shadow-sm transition-colors hover:bg-primary-hover"
          >
            {t("welcome.entry.welcome.start")}
          </Link>
          <Link
            href="/auth"
            data-testid="welcome-login"
            className="press inline-flex h-14 w-full items-center justify-center rounded-2xl border-2 border-border bg-card px-6 text-base font-bold text-foreground transition-colors hover:border-primary/50"
          >
            {t("welcome.entry.welcome.have_account")}
          </Link>
        </div>
      }
    >
      <WelcomeLanguage current={locale} />
      {/* haqiqiy surat (4:3, kenglikka qarab — ekran balandligiga bog'liq emas); tugmalar pastda yopishqoq, doim ko'rinadi */}
      <div className="relative mt-4 aspect-[4/3] w-full overflow-hidden rounded-2xl bg-secondary shadow-sm">
        <EntryImage slot="home_photo" media={media} sizes="(min-width: 640px) 448px, 100vw" className="size-full object-cover object-top" />
        <span className="sr-only">{t("welcome.entry.welcome.photo_alt")}</span>
      </div>
      <h1 className="mt-6 text-2xl font-bold leading-tight tracking-tight sm:text-3xl">{t("welcome.entry.welcome.title")}</h1>
      <p className="mt-2 text-base leading-relaxed text-muted-foreground">{t("welcome.entry.welcome.subtitle")}</p>
      {error ? (
        <p className="mt-4 rounded-xl bg-destructive-soft p-3 text-sm font-medium text-destructive" role="alert">
          {t("welcome.entry.role.error")}
        </p>
      ) : null}
      <p className="mt-3 text-sm font-semibold text-primary-ink">{t("welcome.splash.slogan")}</p>
      <div className="flex-1" />
    </EntryScreen>
  );
}
