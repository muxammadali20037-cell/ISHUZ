import Link from "next/link";
import { ChevronRight, FileText, Gift, type LucideIcon } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { getWorkerDashboardStats } from "../../queries";

function StatTile({ href, icon: Icon, value, label }: { href: string; icon: LucideIcon; value: number; label: string }) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-2xl border border-border/70 bg-card p-4 shadow-sm transition-colors hover:border-primary/40"
    >
      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
        <Icon className="size-5" />
      </span>
      <span className="min-w-0">
        <span className="block text-2xl font-extrabold leading-none tabular">{value}</span>
        <span className="mt-1 block truncate text-xs text-muted-foreground">{label}</span>
      </span>
      <ChevronRight className="ml-auto size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
    </Link>
  );
}

/** worker_dashboard_stats: arizalar va takliflar + profil to'liqligi (< 100 bo'lsa) */
export async function WorkerStats() {
  const [{ t }, stats] = await Promise.all([getT(), getWorkerDashboardStats()]);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <StatTile href="/applications" icon={FileText} value={stats.active_applications} label={t("jobs.home.stats_applications")} />
        <StatTile href="/offers" icon={Gift} value={stats.offers} label={t("jobs.home.stats_offers")} />
      </div>
      {stats.completeness < 100 ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-primary/20 bg-primary-soft/50 p-4 sm:flex-row sm:items-center sm:gap-5">
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{t("jobs.home.completeness_title", { percent: stats.completeness })}</p>
            <p className="mt-0.5 text-sm text-muted-foreground">{t("jobs.home.completeness_desc")}</p>
            <Progress
              value={stats.completeness}
              className="mt-3"
              tone={stats.completeness >= 70 ? "success" : stats.completeness >= 40 ? "primary" : "warning"}
            />
          </div>
          <Button asChild size="sm" className="shrink-0">
            <Link href="/profile/edit">{t("jobs.home.completeness_action")}</Link>
          </Button>
        </div>
      ) : null}
    </div>
  );
}
