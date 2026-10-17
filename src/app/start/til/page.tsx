import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Globe } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { LOCALE_COOKIE } from "@/lib/i18n/config";
import { EntryHeading, EntryIcon, EntryScreen } from "@/features/entry/components/entry-screen";
import { LanguagePicker } from "@/features/entry/components/language-picker";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("welcome.entry.language.title"), robots: { index: false } };
}

/** 2-ekran (birinchi amal): til. Tanlov cookie + profilda saqlanadi; keyingi ekranlar shu tilda */
export default async function LanguagePage() {
  const [{ t, locale }, jar] = await Promise.all([getT(), cookies()]);
  return (
    <EntryScreen>
      <div className="pt-4">
        <EntryIcon>
          <Globe />
        </EntryIcon>
        <EntryHeading className="mt-5" title={t("welcome.entry.language.title")} subtitle={t("welcome.entry.language.subtitle")} />
      </div>
      <LanguagePicker current={locale} chosen={!!jar.get(LOCALE_COOKIE)?.value} />
    </EntryScreen>
  );
}
