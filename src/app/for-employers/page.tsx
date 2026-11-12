import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BadgeCheck, Building2, FileText, Flag, Handshake, Inbox, MessageCircle, ShieldCheck, Users } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { localeAlternates } from "@/lib/seo";
import { createClient } from "@/lib/supabase/server";
import { billingEnabled } from "@/lib/features";
import { findHref, EMPTY_FIND } from "@/features/find/params";
import { Shell } from "@/components/shared/shell";
import { Button } from "@/components/ui/button";

export async function generateMetadata(): Promise<Metadata> {
  const { t, locale } = await getT();
  return { title: t("welcome.employers.meta_title"), description: t("welcome.employers.lead"), alternates: localeAlternates("/for-employers", locale) };
}

/**
 * /for-employers — "Ish beruvchilar uchun": jarayon (4 qadam), nomzodlar bilan ishlash, ishonch (tasdiqlash, moderatsiya,
 * shikoyatlar) va narx haqida HALOL ma'lumot: e'lon pullik/bepulligi bazadagi `listings_paid()` dan olinadi; aniq narx
 * joylashdan oldin ko'rsatiladi. Soxta raqam, sharh yoki "minglab kompaniyalar" yo'q.
 */
export default async function ForEmployersPage() {
  const { t } = await getT();
  const supabase = await createClient();
  const { data: paid, error } = await supabase.rpc("listings_paid");
  const priceKnown = !error;
  const steps = [
    { icon: Building2, title: t("welcome.employers.step1_title"), text: t("welcome.employers.step1_text") },
    { icon: FileText, title: t("welcome.employers.step2_title"), text: t("welcome.employers.step2_text") },
    { icon: Inbox, title: t("welcome.employers.step3_title"), text: t("welcome.employers.step3_text") },
    { icon: Handshake, title: t("welcome.employers.step4_title"), text: t("welcome.employers.step4_text") },
  ];
  const tools = [
    { icon: Users, title: t("welcome.employers.tool_candidates_title"), text: t("welcome.employers.tool_candidates_text") },
    { icon: MessageCircle, title: t("welcome.employers.tool_chat_title"), text: t("welcome.employers.tool_chat_text") },
    { icon: Inbox, title: t("welcome.employers.tool_pipeline_title"), text: t("welcome.employers.tool_pipeline_text") },
  ];
  const trust = [
    { icon: BadgeCheck, title: t("welcome.employers.trust_verify_title"), text: t("welcome.employers.trust_verify_text") },
    { icon: ShieldCheck, title: t("welcome.employers.trust_moderation_title"), text: t("welcome.employers.trust_moderation_text") },
    { icon: Flag, title: t("welcome.employers.trust_reports_title"), text: t("welcome.employers.trust_reports_text") },
  ];
  const faq = [1, 2, 3, 4].map((i) => ({ q: t(`welcome.employers.faq${i}_q`), a: t(`welcome.employers.faq${i}_a`) }));
  const workersHref = findHref(EMPTY_FIND, { mode: "workers" });

  return (
    <Shell>
      <section className="border-b border-border bg-card">
        <div className="container-app py-10 sm:py-14">
          <p className="text-sm font-bold uppercase tracking-wide text-primary-ink">{t("welcome.employers.eyebrow")}</p>
          <h1 className="mt-2 max-w-3xl text-3xl font-extrabold tracking-tight sm:text-5xl">{t("welcome.employers.title")}</h1>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted-foreground">{t("welcome.employers.lead")}</p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <Button asChild size="lg">
              <Link href="/post/vacancy" data-track="home_post_vacancy" data-track-to="for_employers">
                {t("welcome.employers.cta_post")} <ArrowRight className="size-5" aria-hidden />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href={workersHref}>{t("welcome.employers.cta_workers")}</Link>
            </Button>
          </div>
          {priceKnown ? (
            <p className="mt-4 text-sm text-muted-foreground">
              {paid ? t("welcome.employers.price_paid") : t("welcome.employers.price_free")}
              {paid && billingEnabled() ? (
                <>
                  {" "}
                  <Link href="/pricing" className="font-semibold text-primary-ink hover:underline">
                    {t("welcome.employers.price_link")}
                  </Link>
                </>
              ) : null}
            </p>
          ) : null}
        </div>
      </section>

      <div className="container-app space-y-12 py-10 sm:py-14">
        <section aria-labelledby="emp-steps">
          <h2 id="emp-steps" className="text-2xl font-extrabold tracking-tight">
            {t("welcome.employers.steps_title")}
          </h2>
          <ol className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((s, i) => (
              <li key={s.title} className="rounded-2xl border border-border bg-card p-5">
                <span className="flex items-center gap-3">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-primary-soft text-primary-ink">
                    <s.icon className="size-5" aria-hidden />
                  </span>
                  <span className="text-sm font-bold text-muted-foreground">{t("welcome.employers.step_n", { n: i + 1 })}</span>
                </span>
                <h3 className="mt-3 text-lg font-bold">{s.title}</h3>
                <p className="mt-1 text-base leading-relaxed text-muted-foreground">{s.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="emp-tools">
          <h2 id="emp-tools" className="text-2xl font-extrabold tracking-tight">
            {t("welcome.employers.tools_title")}
          </h2>
          <ul className="mt-5 grid gap-3 md:grid-cols-3">
            {tools.map((s) => (
              <li key={s.title} className="flex gap-3 rounded-2xl border border-border bg-card p-5">
                <s.icon className="mt-0.5 size-5 shrink-0 text-primary-ink" aria-hidden />
                <span>
                  <span className="block text-base font-bold">{s.title}</span>
                  <span className="mt-1 block text-base leading-relaxed text-muted-foreground">{s.text}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="emp-trust" className="rounded-2xl border border-border bg-card p-5 sm:p-8">
          <h2 id="emp-trust" className="text-2xl font-extrabold tracking-tight">
            {t("welcome.employers.trust_title")}
          </h2>
          <p className="mt-2 max-w-2xl text-base text-muted-foreground">{t("welcome.employers.trust_lead")}</p>
          <ul className="mt-5 grid gap-5 md:grid-cols-3">
            {trust.map((s) => (
              <li key={s.title}>
                <s.icon className="size-6 text-primary-ink" aria-hidden />
                <h3 className="mt-2 text-base font-bold">{s.title}</h3>
                <p className="mt-1 text-base leading-relaxed text-muted-foreground">{s.text}</p>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="emp-faq">
          <h2 id="emp-faq" className="text-2xl font-extrabold tracking-tight">
            {t("welcome.employers.faq_title")}
          </h2>
          <div className="mt-4 divide-y divide-border rounded-2xl border border-border bg-card">
            {faq.map((f) => (
              <details key={f.q} className="group p-5">
                <summary className="cursor-pointer list-none text-base font-bold marker:hidden">
                  <span className="flex items-center justify-between gap-3">
                    {f.q}
                    <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" aria-hidden />
                  </span>
                </summary>
                <p className="mt-2 text-base leading-relaxed text-muted-foreground">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="flex flex-col items-start gap-4 rounded-2xl border border-primary/25 bg-primary-soft p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <div>
            <h2 className="text-2xl font-extrabold tracking-tight">{t("welcome.employers.final_title")}</h2>
            <p className="mt-1 text-base text-muted-foreground">{t("welcome.employers.final_text")}</p>
          </div>
          <Button asChild size="lg" className="shrink-0">
            <Link href="/post/vacancy" data-track="home_post_vacancy" data-track-to="for_employers_final">
              {t("welcome.employers.cta_post")} <ArrowRight className="size-5" aria-hidden />
            </Link>
          </Button>
        </section>
      </div>
    </Shell>
  );
}
