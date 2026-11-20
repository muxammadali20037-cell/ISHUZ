import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import { BRAND } from "@/config/brand";
import { BrandLogo } from "@/components/shared/brand-logo";
import { EntryHeading, EntryScreen } from "./entry-screen";
import { RolePicker } from "./role-picker";
import { WelcomeLanguage } from "./welcome-language";

/**
 * Birinchi ochilish (ega, 2026-11-20: "rasmlar yoqmayapti — savol bilan kirish kerak"): rasm va shiorlar yo'q. Tepada til,
 * keyin savol va ikkita katta karta — «O'zingizga mos ish qidiryapsizmi?» / «Korxonangizga ishchi qidiryapsizmi?». Bitta
 * bosishda rol tanlanadi va asosiy ekran (chat) ochiladi — kirish so'ralmaydi. Pastda — "Hisobim bor — kirish".
 */
export async function WelcomeScreen({ error = false, next = null }: { error?: boolean; next?: string | null }) {
  const { t, locale } = await getT();
  return (
    <EntryScreen
      left={<BrandLogo className="px-3 text-lg" label={BRAND.name} />}
      footer={
        <p className="text-center text-sm text-muted-foreground" data-welcome-actions>
          {t("welcome.entry.welcome.have_account_q")}{" "}
          <Link href="/auth" data-testid="welcome-login" className="inline-flex min-h-11 items-center px-1 font-bold text-primary-ink hover:underline">
            {t("welcome.entry.welcome.login")}
          </Link>
        </p>
      }
    >
      <WelcomeLanguage current={locale} />
      <EntryHeading className="mt-8" title={t("welcome.entry.welcome.title")} subtitle={t("welcome.entry.welcome.subtitle")} />
      {error ? (
        <p className="mt-4 rounded-xl bg-destructive-soft p-3 text-sm font-medium text-destructive" role="alert">
          {t("welcome.entry.role.error")}
        </p>
      ) : null}
      <RolePicker initial={null} next={next ?? ""} welcome={{ locale }} />
      <div className="flex-1" />
    </EntryScreen>
  );
}
