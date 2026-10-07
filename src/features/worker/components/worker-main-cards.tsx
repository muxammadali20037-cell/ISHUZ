import Link from "next/link";
import { BookmarkCheck, ChevronRight, FileText, Gift, GraduationCap, HelpCircle, IdCard, Search, User } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Ish qidiruvchi bosh sahifasining birinchi ko'rinishi (spec §9): aynan ikkita asosiy katta karta —
 * "Bo'sh ish o'rinlarini ko'rish" va "Ish qidirish e'loni yaratish" (bor bo'lsa — holati bilan), keyin ixcham yo'llar.
 */
export async function WorkerMainCards({ workerId }: { workerId: string }) {
  const supabase = await createClient();
  const [{ t, tEnum }, { data: w }] = await Promise.all([
    getT(),
    supabase.from("worker_profiles").select("is_public, status, completeness").eq("id", workerId).maybeSingle(),
  ]);
  const listed = !!w?.is_public && w.status !== "not_looking";
  const secondary = [
    { href: "/applications", icon: FileText, label: t("jobs.worker_home.applications") },
    { href: "/saved", icon: BookmarkCheck, label: t("jobs.worker_home.saved") },
    { href: "/offers", icon: Gift, label: t("jobs.worker_home.offers") },
    { href: "/profile", icon: User, label: t("jobs.worker_home.profile") },
    { href: "/help", icon: HelpCircle, label: t("jobs.worker_home.help") },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Link href="/jobs" data-tour="worker-jobs" className="group flex min-h-36 flex-col justify-between rounded-3xl bg-primary p-5 text-primary-foreground shadow-md transition-transform hover:-translate-y-0.5 sm:p-6">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-white/15">
            <Search className="size-7" />
          </span>
          <span className="mt-4 block">
            <span className="flex items-center gap-2 text-xl font-extrabold">
              {t("jobs.worker_home.browse_title")} <ChevronRight className="size-5 transition-transform group-hover:translate-x-1" />
            </span>
            <span className="mt-1 block text-[15px] text-primary-foreground/85">{t("jobs.worker_home.browse_desc")}</span>
          </span>
        </Link>
        <Link
          href="/profile/listing"
          data-tour="worker-listing"
          className="group flex min-h-36 flex-col justify-between rounded-3xl border-2 border-primary/30 bg-card p-5 shadow-sm transition-transform hover:-translate-y-0.5 hover:border-primary sm:p-6"
        >
          <span className="flex items-center justify-between">
            <span className="flex size-14 items-center justify-center rounded-2xl bg-primary-soft text-primary">
              <IdCard className="size-7" />
            </span>
            {w ? (
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${listed ? "bg-success-soft text-success" : "bg-secondary text-muted-foreground"}`}>
                {listed ? tEnum("worker_status_short", w.status) : t("jobs.worker_home.listing_hidden")}
              </span>
            ) : null}
          </span>
          <span className="mt-4 block">
            <span className="flex items-center gap-2 text-xl font-extrabold">
              {listed ? t("jobs.worker_home.listing_mine") : t("jobs.worker_home.listing_title")} <ChevronRight className="size-5 text-primary transition-transform group-hover:translate-x-1" />
            </span>
            <span className="mt-1 block text-[15px] text-muted-foreground">{t("jobs.worker_home.listing_desc")}</span>
          </span>
        </Link>
      </div>

      <nav data-tour="worker-more" aria-label={t("jobs.worker_home.more")} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        {secondary.map((s) => (
          <Link key={s.href} href={s.href} className="flex shrink-0 items-center gap-2 rounded-2xl border border-border bg-card px-4 py-3 text-sm font-semibold hover:border-primary hover:text-primary">
            <s.icon className="size-4 text-primary" /> {s.label}
          </Link>
        ))}
      </nav>

      <Link href="/students" className="flex items-center gap-3 rounded-2xl border border-dashed border-primary/40 bg-primary-soft/30 p-4 hover:bg-primary-soft/60">
        <GraduationCap className="size-6 shrink-0 text-primary" />
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">{t("jobs.worker_home.students_title")}</span>
          <span className="block text-sm text-muted-foreground">{t("jobs.worker_home.students_desc")}</span>
        </span>
        <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
      </Link>
    </div>
  );
}
