import Link from "next/link";
import { BadgeCheck, BriefcaseBusiness, FileUser } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { Avatar } from "@/components/ui/avatar";
import { getMarketOverview } from "../market";

/**
 * Kompyuterdagi o'ng panel (natijalar yonida): statistika, yirik ish beruvchilar va joriy rejimga mos "e'lon berish".
 * Telefonda ko'rsatilmaydi (ro'yxat birinchi). Ma'lumot yuklanmasa — faqat tugma qoladi.
 */
export async function MarketAside({ mode }: { mode: "jobs" | "workers" }) {
  const [{ t, locale }, m] = await Promise.all([getT(), getMarketOverview()]);
  const num = new Intl.NumberFormat(locale === "en" ? "en-US" : "ru-RU");
  const stats = m
    ? [
        { key: "jobs", label: t("easy.market.jobs"), value: m.jobs },
        { key: "workers", label: t("easy.market.workers"), value: m.workers },
        { key: "companies", label: t("easy.market.companies"), value: m.companies },
      ]
    : [];
  const jobs = mode === "jobs";
  return (
    <aside className="hidden space-y-4 lg:sticky lg:top-20 lg:block lg:self-start" aria-label={t("easy.market.title")}>
      <Link
        href={jobs ? "/post/worker" : "/post/vacancy"}
        className="press flex min-h-12 items-center gap-2.5 rounded-xl bg-primary px-4 py-2.5 text-base font-bold text-primary-foreground shadow-sm hover:bg-primary-hover"
      >
        {jobs ? <FileUser className="size-5 shrink-0" aria-hidden /> : <BriefcaseBusiness className="size-5 shrink-0" aria-hidden />}
        {jobs ? t("easy.market.post_resume") : t("easy.market.post_vacancy")}
      </Link>

      {stats.length ? (
        <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <h2 className="text-lg font-bold">{t("easy.market.title")}</h2>
          <dl className="mt-3 grid grid-cols-3 gap-2">
            {stats.map((s) => (
              <div key={s.key} className="flex flex-col-reverse rounded-xl bg-secondary px-2.5 py-2.5">
                <dt className="text-xs font-medium text-muted-foreground">{s.label}</dt>
                <dd className="text-lg font-extrabold leading-tight tabular">{num.format(s.value)}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      {m?.top.length ? (
        <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <h2 className="text-lg font-bold">{t("easy.market.top")}</h2>
          <ul className="mt-3 grid grid-cols-2 gap-2">
            {m.top.map((c) => (
              <li key={c.slug}>
                <Link
                  href={`/company/${c.slug}`}
                  className="flex h-full flex-col items-center gap-1.5 rounded-xl border border-border px-2 py-3 text-center transition-colors hover:border-primary/50 hover:bg-primary-soft/30"
                >
                  <Avatar src={c.logoUrl} fallback={c.name.slice(0, 2)} square size="lg" alt="" className="size-12" />
                  <span className="flex max-w-full items-center gap-1 text-sm font-semibold">
                    <span className="truncate">{c.name}</span>
                    {c.verified ? <BadgeCheck className="size-4 shrink-0 text-primary" aria-label={t("jobs.detail.company_verified")} /> : null}
                  </span>
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium">{t("easy.market.jobs_count", { count: c.count })}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </aside>
  );
}
