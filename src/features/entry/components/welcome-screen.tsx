import { cookies } from "next/headers";
import Link from "next/link";
import { ArrowRight, BriefcaseBusiness, UsersRound } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { LOCALE_COOKIE } from "@/lib/i18n/config";
import { BRAND } from "@/config/brand";
import { BrandLogo } from "@/components/shared/brand-logo";
import { getEntryStats } from "@/features/landing/entry-queries";
import { getEntryMedia } from "../queries";
import { pickWelcomeRole } from "../actions";
import { EntryImage } from "./entry-art";
import { EntryScreen } from "./entry-screen";
import { WelcomeLanguage } from "./welcome-language";

/**
 * Xush kelibsiz ekrani — 2.0 (2026-11-11, egasi: "kirishni soddalashtir, rasmlar bilan ish beruvchi / ish qidiruvchi"):
 * til → tanishtiruv (3 slayd) → rol o'rniga BITTA ekran:
 *  - tepada brend va shior; til qatori (bosilsa darhol shu tilga o'tadi);
 *  - ikkita katta rasmli karta: "Ish qidiryapman" / "Ishchi qidiryapman" — bitta bosish bilan o'z bosh sahifasiga;
 *  - kirish talab qilinmaydi (e'lon berish yoki ariza paytida so'raladi); pastda "Qanday ishlaydi?" (slaydlar) va "Kirish".
 * JS'siz ham ishlaydi: kartalar — oddiy forma tugmalari.
 */
export async function WelcomeScreen({ error = false, next = null }: { error?: boolean; next?: string | null }) {
  const [{ t, locale }, jar, stats, media] = await Promise.all([getT(), cookies(), getEntryStats(), getEntryMedia()]);
  const live = stats && stats.today > 0 ? t("welcome.entry.today", { count: new Intl.NumberFormat("ru-RU").format(stats.today) }) : null;
  const roles = [
    { mode: "worker" as const, slot: "role_worker" as const, title: t("welcome.entry.role.worker_title"), desc: t("welcome.entry.welcome.worker_desc"), icon: BriefcaseBusiness },
    { mode: "employer" as const, slot: "role_employer" as const, title: t("welcome.entry.role.employer_title"), desc: t("welcome.entry.welcome.employer_desc"), icon: UsersRound },
  ];
  return (
    <EntryScreen className="sm:max-w-2xl">
      {/* kichik telefonda (320×700) ham ikkala karta ekranda: brend ixcham, jonli son til qatori yonida emas — sarlavha ostida */}
      <div className="text-center">
        <BrandLogo className="mx-auto text-2xl" label={BRAND.name} />
        <p className="mt-1 text-xs font-semibold text-muted-foreground">{t("welcome.splash.slogan")}</p>
      </div>
      <div className="mt-4">
        <WelcomeLanguage current={locale} />
      </div>
      <h1 className="mt-5 text-center text-xl font-extrabold leading-tight tracking-tight sm:text-3xl">{t("welcome.entry.welcome.title")}</h1>
      <p className="mx-auto mt-1.5 max-w-sm text-center text-sm leading-snug text-muted-foreground sm:text-base">{t("welcome.entry.welcome.subtitle")}</p>
      {live ? (
        <p className="mx-auto mt-2 inline-flex items-center gap-2 self-center rounded-full bg-primary-soft px-3 py-1 text-xs font-bold text-primary-ink">
          <span className="entry-live" aria-hidden />
          {live}
        </p>
      ) : null}
      {error ? (
        <p className="mt-4 rounded-xl bg-destructive/10 p-3 text-center text-sm font-medium text-destructive" role="alert">
          {t("welcome.entry.role.error")}
        </p>
      ) : null}
      <form action={pickWelcomeRole} className="mt-4 grid gap-3 sm:grid-cols-2 sm:gap-4" data-welcome-roles>
        <input type="hidden" name="locale" value={jar.get(LOCALE_COOKIE)?.value ?? locale} />
        {next ? <input type="hidden" name="next" value={next} /> : null}
        {roles.map((r) => (
          <button
            key={r.mode}
            type="submit"
            name="mode"
            value={r.mode}
            data-testid={`role-${r.mode}`}
            className="press group flex w-full items-center gap-3 overflow-hidden rounded-2xl border-2 border-border bg-card p-2.5 pr-3 text-left transition-colors hover:border-primary focus-visible:border-primary sm:flex-col sm:items-stretch sm:p-0 sm:text-center"
          >
            {/* rasm: admin yuklagan yoki o'rnatilgan surat (egasi bergan) */}
            <span className="size-20 shrink-0 overflow-hidden rounded-xl sm:aspect-[4/3] sm:size-auto sm:w-full sm:rounded-none">
              <EntryImage slot={r.slot} media={media} sizes="(min-width: 640px) 320px, 96px" className="size-full object-cover" />
            </span>
            <span className="min-w-0 flex-1 sm:px-5 sm:pb-5 sm:pt-4">
              <span className="flex items-center gap-2 text-base font-extrabold leading-tight sm:justify-center sm:text-lg">
                <r.icon className="size-5 shrink-0 text-primary-ink" aria-hidden />
                {r.title}
              </span>
              <span className="mt-0.5 block text-sm leading-snug text-muted-foreground">{r.desc}</span>
              <span className="mt-1 inline-flex items-center gap-1 text-sm font-bold text-primary-ink">
                {t("welcome.entry.welcome.go")} <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
              </span>
            </span>
          </button>
        ))}
      </form>
      <div className="flex-1" />
      <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1 pb-[max(0.75rem,var(--safe-bottom))] pt-4 text-sm">
        <Link href="/start/tanishtiruv?next=%2Fstart%2Ftil" className="inline-flex min-h-11 items-center font-semibold text-primary-ink hover:underline">
          {t("welcome.entry.welcome.how")}
        </Link>
        <Link href="/auth" className="inline-flex min-h-11 items-center font-semibold text-muted-foreground hover:text-foreground">
          {t("welcome.entry.have_account")} {t("welcome.entry.login")}
        </Link>
      </div>
    </EntryScreen>
  );
}
