import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { formatDateTime, formatRelative } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import { getAdminContext } from "@/features/admin/context";
import { getQueueStatus } from "@/features/admin/queries/panel";
import { AdminPageHeader, Forbidden, QueryError } from "@/features/admin/components/notes";
import { RetryQueueButton } from "@/features/admin/components/retry-button";
import { StatTile } from "@/features/admin/components/stat-tile";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: `${t("admin.nav.queues")} · ${t("admin.shell.title")}` };
}

function Errors({ items, locale }: { items: { created_at: string; text: string | null; label: string }[]; locale: Locale }) {
  if (!items.length) return null;
  return (
    <ul className="mt-3 space-y-1 text-xs">
      {items.map((e, i) => (
        <li key={i} className="flex flex-wrap gap-x-2">
          <span className="font-mono text-muted-foreground" title={formatDateTime(e.created_at, locale)}>{formatRelative(e.created_at, locale)}</span>
          <span className="font-medium">{e.label}</span>
          <span className="text-destructive [overflow-wrap:anywhere]">{e.text ?? "—"}</span>
        </li>
      ))}
    </ul>
  );
}

/** Navbatlar: moderatsiya, moslik hisoblash, Telegram yuborish, AI — holat, xatolar, qayta urinish */
export default async function AdminQueuesPage() {
  const ctx = await getAdminContext();
  const { t, locale } = await getT();
  if (!ctx.can("audit.view")) return <Forbidden perm="audit.view" />;
  const { status, error } = await getQueueStatus();
  const canRetry = ctx.can("settings.manage");
  return (
    <div className="space-y-6">
      <AdminPageHeader title={t("admin.queues.title")} subtitle={t("admin.queues.subtitle")} />
      <QueryError message={error} />
      {status ? (
        <>
          <section className="rounded-2xl border border-border bg-card p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="font-semibold">{t("admin.queues.moderation")}</h2>
              {canRetry ? <RetryQueueButton kind="moderation" disabled={!status.moderation.retrying} /> : null}
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              <StatTile label={t("admin.queues.pending")} value={status.moderation.pending} />
              <StatTile label={t("admin.queues.retrying")} value={status.moderation.retrying} tone={status.moderation.retrying ? "warning" : "default"} />
              <StatTile label={t("admin.queues.review")} value={status.moderation.review} href="/admin/moderation" />
              <StatTile label={t("admin.queues.errors_24h")} value={status.moderation.errors_24h} tone={status.moderation.errors_24h ? "destructive" : "default"} />
              <StatTile label={t("admin.queues.oldest")} value={status.moderation.oldest ? formatRelative(status.moderation.oldest, locale) : "—"} />
            </div>
            <Errors locale={locale} items={status.moderation.last_errors.map((e) => ({ created_at: e.created_at, text: e.error, label: e.entity_type }))} />
          </section>
          <section className="rounded-2xl border border-border bg-card p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="font-semibold">{t("admin.queues.match_jobs")}</h2>
              {canRetry ? <RetryQueueButton kind="match_jobs" disabled={!status.match_jobs.failed} /> : null}
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <StatTile label={t("admin.queues.queued")} value={status.match_jobs.queued} />
              <StatTile label={t("admin.queues.running")} value={status.match_jobs.running} />
              <StatTile label={t("admin.queues.failed")} value={status.match_jobs.failed} tone={status.match_jobs.failed ? "destructive" : "default"} />
              <StatTile label={t("admin.queues.done_24h")} value={status.match_jobs.done_24h} tone="success" />
            </div>
            <Errors locale={locale} items={status.match_jobs.last_errors.map((e) => ({ created_at: e.created_at, text: e.last_error, label: e.entity_type }))} />
          </section>
          <section className="rounded-2xl border border-border bg-card p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="font-semibold">{t("admin.queues.telegram")}</h2>
              {canRetry ? <RetryQueueButton kind="telegram" disabled={!status.telegram.failed_24h} /> : null}
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              <StatTile label={t("admin.queues.queued")} value={status.telegram.queued} />
              <StatTile label={t("admin.queues.due")} value={status.telegram.due} tone={status.telegram.due > 50 ? "warning" : "default"} />
              <StatTile label={t("admin.queues.retrying")} value={status.telegram.retrying} />
              <StatTile label={t("admin.queues.sent_24h")} value={status.telegram.sent_24h} tone="success" />
              <StatTile label={t("admin.queues.failed_24h")} value={status.telegram.failed_24h} tone={status.telegram.failed_24h ? "destructive" : "default"} />
            </div>
            <Errors locale={locale} items={status.telegram.last_errors.map((e) => ({ created_at: e.created_at, text: e.tg_error, label: `${e.type} · ${e.tg_status}` }))} />
          </section>
          <section className="rounded-2xl border border-border bg-card p-4">
            <h2 className="mb-3 font-semibold">{t("admin.queues.ai")}</h2>
            <div className="grid grid-cols-2 gap-3">
              <StatTile label={t("admin.queues.ai_requests")} value={status.ai_24h.requests} />
              <StatTile label={t("admin.queues.ai_errors")} value={status.ai_24h.errors} tone={status.ai_24h.errors ? "destructive" : "default"} />
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
