import type { Metadata } from "next";
import { cookies } from "next/headers";
import { getT } from "@/lib/i18n/server";
import { LOCALE_COOKIE } from "@/lib/i18n/config";
import { EntryBrand, EntryHeading, EntryScreen } from "@/features/entry/components/entry-screen";
import { getEntryStats } from "@/features/landing/entry-queries";
import { BRAND } from "@/config/brand";
import { LanguagePicker } from "@/features/entry/components/language-picker";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("welcome.entry.language.title"), robots: { index: false } };
}

/** 2-ekran (birinchi amal): til. Tanlov cookie + profilda saqlanadi; keyingi ekranlar shu tilda */
export default async function LanguagePage() {
  const [{ t, locale }, jar, stats] = await Promise.all([getT(), cookies(), getEntryStats()]);
  return (
    <EntryScreen>
      <div className="pt-1">
        <EntryBrand
          name={BRAND.name}
          slogan={t("welcome.splash.slogan")}
          live={stats && stats.today > 0 ? t("welcome.entry.today", { count: new Intl.NumberFormat("ru-RU").format(stats.today) }) : null}
        />
        <EntryHeading className="mt-6" title={t("welcome.entry.language.title")} subtitle={t("welcome.entry.language.subtitle")} />
      </div>
      <LanguagePicker current={locale} chosen={!!jar.get(LOCALE_COOKIE)?.value} />
    </EntryScreen>
  );
}
