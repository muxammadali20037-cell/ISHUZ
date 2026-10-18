import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, Info, MessageCircle, ShieldCheck } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { getServerEnv } from "@/lib/env";
import { localeAlternates } from "@/lib/seo";
import { Shell } from "@/components/shared/shell";
import { Button } from "@/components/ui/button";

export async function generateMetadata(): Promise<Metadata> {
  const { t, locale } = await getT();
  return { title: t("welcome.about.title"), description: t("welcome.about.lead"), alternates: localeAlternates("/about", locale) };
}

/**
 * /about — "Biz haqimizda": platforma nima qiladi, ishonch qanday ta'minlanadi va nimani va'da qilmaydi. Raqam va
 * sharhlar yo'q (soxta ijtimoiy isbot yo'q). Aloqa — faqat sozlangan kanallar (SUPPORT_EMAIL, rasmiy bot, operator).
 */
export default async function AboutPage() {
  const { t } = await getT();
  const { SUPPORT_EMAIL, TELEGRAM_BOT_USERNAME, LEGAL_OPERATOR } = getServerEnv();
  const bot = TELEGRAM_BOT_USERNAME?.replace(/^@/, "") || null;
  const blocks = [
    { icon: Info, title: t("welcome.about.what_title"), items: [1, 2, 3, 4].map((i) => t(`welcome.about.what_${i}`)) },
    { icon: ShieldCheck, title: t("welcome.about.trust_title"), items: [1, 2, 3, 4].map((i) => t(`welcome.about.trust_${i}`)) },
    { icon: CheckCircle2, title: t("welcome.about.honest_title"), items: [1, 2, 3].map((i) => t(`welcome.about.honest_${i}`)) },
  ];
  return (
    <Shell>
      <div className="container-narrow space-y-6 py-6 sm:py-10">
        <header>
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{t("welcome.about.title")}</h1>
          <p className="mt-3 text-lg leading-relaxed text-muted-foreground">{t("welcome.about.lead")}</p>
        </header>
        {blocks.map((b) => (
          <section key={b.title} className="rounded-2xl border border-border bg-card p-5 sm:p-6">
            <h2 className="flex items-center gap-2 text-xl font-bold">
              <b.icon className="size-5 text-primary" aria-hidden /> {b.title}
            </h2>
            <ul className="mt-3 space-y-2.5">
              {b.items.map((it) => (
                <li key={it} className="flex gap-2.5 text-base leading-relaxed">
                  <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                  <span>{it}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
        <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
          <h2 className="flex items-center gap-2 text-xl font-bold">
            <MessageCircle className="size-5 text-primary" aria-hidden /> {t("welcome.about.contact_title")}
          </h2>
          <dl className="mt-3 space-y-2 text-base">
            {SUPPORT_EMAIL ? (
              <div className="flex flex-wrap gap-x-2">
                <dt className="font-semibold">{t("welcome.about.contact_email")}:</dt>
                <dd>
                  <a className="text-primary hover:underline" href={`mailto:${SUPPORT_EMAIL}`}>
                    {SUPPORT_EMAIL}
                  </a>
                </dd>
              </div>
            ) : null}
            {bot ? (
              <div className="flex flex-wrap gap-x-2">
                <dt className="font-semibold">{t("welcome.about.contact_bot")}:</dt>
                <dd>
                  <a className="text-primary hover:underline" href={`https://t.me/${bot}`} target="_blank" rel="noopener noreferrer">
                    @{bot}
                  </a>
                </dd>
              </div>
            ) : null}
            {LEGAL_OPERATOR ? (
              <div className="flex flex-wrap gap-x-2">
                <dt className="font-semibold">{t("welcome.about.operator")}:</dt>
                <dd>{LEGAL_OPERATOR}</dd>
              </div>
            ) : null}
          </dl>
          <p className="mt-3 text-base">
            <Link href="/help" className="font-semibold text-primary hover:underline">
              {t("welcome.about.contact_help")}
            </Link>
          </p>
        </section>
        <div className="flex flex-col gap-2.5 sm:flex-row">
          <Button asChild size="lg" className="h-12">
            <Link href="/search?mode=jobs">{t("welcome.about.cta_jobs")}</Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="h-12">
            <Link href="/post/vacancy">{t("welcome.about.cta_post")}</Link>
          </Button>
        </div>
      </div>
    </Shell>
  );
}
