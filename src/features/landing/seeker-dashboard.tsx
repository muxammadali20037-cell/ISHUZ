import Link from "next/link";
import { ArrowRight, Bookmark, CalendarCheck2, Eye, Send, type LucideIcon } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { formatRelative } from "@/lib/format";
import { SalaryText } from "@/components/shared/salary-text";
import { getWorkerApplications } from "@/features/applications/queries";
import { ApplicationStatusBadge } from "@/features/applications/components/status-badge";
import { listSavedJobs } from "@/features/saved/queries";

/**
 * Ish izlovchi bosh sahifasidagi "Mening faoliyatim" (2026-11 redizayn, "Hirelly" uslubi): uchta raqam kartasi (yuborilgan
 * arizalar · ko'rib chiqilayotganlar · suhbat va takliflar) va saqlanganlar soni, kompyuterda — "So'nggi arizalar" (holat
 * belgisi bilan) va "Saqlangan vakansiyalar" panellari. Hammasi — foydalanuvchining o'z ma'lumoti; hali ariza ham, saqlangan ham
 * bo'lmasa — bo'lim ko'rsatilmaydi (bo'sh "0" kartalar yo'q). Xato bo'lsa — bo'lim yo'q (bosh sahifa ishlashda davom etadi).
 */
export async function SeekerActivity({ workerId }: { workerId: string }) {
  const [{ t, locale }, apps, saved] = await Promise.all([
    getT(),
    getWorkerApplications(workerId).catch((e) => {
      console.warn("[home] activity applications", e instanceof Error ? e.message : e);
      return null;
    }),
    listSavedJobs(),
  ]);
  if (!apps) return null;
  if (!apps.length && !saved.items.length) return null;
  const count = (...s: string[]) => apps.filter((a) => s.includes(a.status)).length;
  const stats: { key: string; icon: LucideIcon; value: number; label: string; href: string; tone: string }[] = [
    { key: "sent", icon: Send, value: apps.filter((a) => a.status !== "withdrawn").length, label: t("easy.activity.stat_sent"), href: "/applications", tone: "bg-primary text-primary-foreground" },
    { key: "review", icon: Eye, value: count("viewed", "shortlisted"), label: t("easy.activity.stat_review"), href: "/applications", tone: "bg-info-soft text-info" },
    { key: "interview", icon: CalendarCheck2, value: count("interview", "offered", "hired"), label: t("easy.activity.stat_interview"), href: "/applications", tone: "bg-success-soft text-success" },
    { key: "saved", icon: Bookmark, value: saved.items.length, label: t("easy.activity.stat_saved"), href: "/saved", tone: "bg-highlight-soft text-highlight-soft-foreground" },
  ];
  const recent = apps.filter((a) => a.vacancy).slice(0, 4);
  const savedTop = saved.items.slice(0, 4);
  return (
    <section aria-labelledby="activity-title" className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 id="activity-title" className="text-xl font-bold">
            {t("easy.activity.title")}
          </h2>
          <p className="text-sm text-muted-foreground">{t("easy.activity.subtitle")}</p>
        </div>
      </div>
      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <li key={s.key} className="flex">
            <Link href={s.href} className="press flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-4 hover:border-primary/40">
              <span className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${s.tone}`} aria-hidden>
                <s.icon className="size-5" />
              </span>
              <span className="min-w-0">
                <span className="tabular block text-2xl font-extrabold leading-none">{s.value}</span>
                <span className="mt-1 block text-sm leading-snug text-muted-foreground">{s.label}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <div className="hidden gap-4 lg:grid lg:grid-cols-2">
        <Panel title={t("easy.activity.recent_title")} href="/applications" all={t("common.actions.view_all")}>
          {recent.length ? (
            <ul className="divide-y divide-border">
              {recent.map((a) => (
                <li key={a.id}>
                  <Link href={`/applications/${a.id}`} className="flex items-center gap-3 py-3 hover:text-primary-ink">
                    <Initial text={a.vacancy!.company?.name ?? a.vacancy!.title} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-base font-semibold">{a.vacancy!.title}</span>
                      <span className="block truncate text-sm text-muted-foreground">
                        {a.vacancy!.company?.name ? `${a.vacancy!.company.name} · ` : ""}
                        {formatRelative(a.updated_at, locale)}
                      </span>
                    </span>
                    <ApplicationStatusBadge status={a.status} className="shrink-0" />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <Empty text={t("easy.activity.recent_empty")} href="/jobs" cta={t("easy.activity.find_jobs")} />
          )}
        </Panel>
        <Panel title={t("easy.activity.saved_title")} href="/saved" all={t("common.actions.view_all")}>
          {savedTop.length ? (
            <ul className="divide-y divide-border">
              {savedTop.map((j) => (
                <li key={j.id}>
                  <Link href={`/jobs/${j.slug}`} className="flex items-center gap-3 py-3 hover:text-primary-ink">
                    <Initial text={j.employer_name ?? j.title} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-base font-semibold">{j.title}</span>
                      <span className="block truncate text-sm text-muted-foreground">{j.employer_name ?? ""}</span>
                    </span>
                    <SalaryText
                      from={j.salary_from}
                      to={j.salary_to}
                      type={j.salary_type}
                      negotiable={j.salary_negotiable}
                      className="max-w-40 shrink-0 truncate text-right text-sm font-bold text-foreground"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <Empty text={t("easy.activity.saved_empty")} href="/jobs" cta={t("easy.activity.find_jobs")} />
          )}
        </Panel>
      </div>
    </section>
  );
}

function Panel({ title, href, all, children }: { title: string; href: string; all: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-bold">{title}</h3>
        <Link href={href} className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-primary-ink hover:underline">
          {all} <ArrowRight className="size-4" aria-hidden />
        </Link>
      </div>
      {children}
    </div>
  );
}

function Initial({ text }: { text: string }) {
  return (
    <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-base font-extrabold uppercase text-primary-ink" aria-hidden>
      {text.trim().slice(0, 1)}
    </span>
  );
}

function Empty({ text, href, cta }: { text: string; href: string; cta: string }) {
  return (
    <div className="py-6 text-center">
      <p className="text-sm text-muted-foreground">{text}</p>
      <Link href={href} className="mt-2 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-primary-ink hover:underline">
        {cta} <ArrowRight className="size-4" aria-hidden />
      </Link>
    </div>
  );
}
