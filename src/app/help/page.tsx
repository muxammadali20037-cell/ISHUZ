import type { Metadata } from "next";
import Link from "next/link";
import { Building2, Flag, LifeBuoy, ShieldCheck, UserSearch } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { Shell } from "@/components/shared/shell";
import { localeAlternates } from "@/lib/seo";
import { ReplayTourButton } from "@/features/legal/replay-tour-button";

export async function generateMetadata(): Promise<Metadata> {
  const { t, locale } = await getT();
  return { title: t("welcome.help.title"), description: t("welcome.help.subtitle"), alternates: localeAlternates("/help", locale) };
}

/** /help — doim bir joyda turadigan matnli qo'llanma (spec §18). Asosiy amallarni tushunish videoga bog'liq emas. */
export default async function HelpPage() {
  const { t } = await getT();
  const guides: { icon: typeof UserSearch; title: string; steps: string[] }[] = [
    { icon: UserSearch, title: t("welcome.help.worker_title"), steps: [1, 2, 3, 4, 5].map((i) => t(`welcome.help.worker_${i}`)) },
    { icon: Building2, title: t("welcome.help.employer_title"), steps: [1, 2, 3, 4, 5].map((i) => t(`welcome.help.employer_${i}`)) },
  ];
  return (
    <Shell>
      <div className="container-narrow space-y-7 py-5 sm:py-8">
        <header className="flex items-start gap-4">
          <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary">
            <LifeBuoy className="size-7" />
          </span>
          <div>
            <h1 className="text-2xl font-extrabold">{t("welcome.help.title")}</h1>
            <p className="mt-1 text-muted-foreground">{t("welcome.help.subtitle")}</p>
          </div>
        </header>

        <ReplayTourButton />

        {guides.map((g) => (
          <section key={g.title} className="rounded-2xl border border-border bg-card p-5">
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <g.icon className="size-5 text-primary" /> {g.title}
            </h2>
            <ol className="mt-3 space-y-2.5">
              {g.steps.map((s, i) => (
                <li key={i} className="flex gap-3 text-[15px]">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-bold text-primary">{i + 1}</span>
                  <span className="pt-0.5">{s}</span>
                </li>
              ))}
            </ol>
          </section>
        ))}

        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <ShieldCheck className="size-5 text-primary" /> {t("welcome.help.safety_title")}
          </h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-[15px]">
            <li>{t("welcome.help.safety_1")}</li>
            <li>{t("welcome.help.safety_2")}</li>
            <li>{t("welcome.help.safety_3")}</li>
          </ul>
          <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
            <Flag className="size-4" /> {t("welcome.help.report_hint")}
          </p>
        </section>

        <p className="text-sm text-muted-foreground">
          {t("welcome.help.more")}{" "}
          <Link href="/privacy" className="font-medium text-primary hover:underline">
            {t("common.footer.privacy")}
          </Link>
          {" · "}
          <Link href="/terms" className="font-medium text-primary hover:underline">
            {t("common.footer.terms")}
          </Link>
        </p>
        {/* Qaysi versiya ochilganini tekshirish uchun (Mini App eski versiyada qolmaganini bilish) */}
        <p className="text-xs text-muted-foreground/70">
          {t("welcome.help.version", { v: (process.env.VERCEL_GIT_COMMIT_SHA ?? "local").slice(0, 7) })}
        </p>
      </div>
    </Shell>
  );
}
