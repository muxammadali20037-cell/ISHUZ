import type { Metadata } from "next";
import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import { formatDateTime, formatRelative, fullName } from "@/lib/format";
import { getAdminContext } from "@/features/admin/context";
import { MODERATION_TABS, QUEUE_PAGE, getModerationHistory, getModerationQueue, type ModerationTab } from "@/features/admin/queries/panel";
import { oneOf, param, parsePage, type SearchParams } from "@/features/admin/queries/shared";
import { LinkTabs } from "@/features/admin/components/link-tabs";
import { AdminPageHeader, Forbidden, QueryError } from "@/features/admin/components/notes";
import { ModerationActions } from "@/features/admin/components/moderation-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: `${t("admin.nav.moderation")} · ${t("admin.shell.title")}` };
}

const BASE = "/admin/moderation";

/** Moderatsiya navbati: AI/qoidalar "ko'rib chiqish"ga qo'ygan, apellyatsiya, kutilayotgan, rad etilgan va xatoli e'lonlar */
export default async function AdminModerationPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const ctx = await getAdminContext();
  const { t, locale } = await getT();
  if (!ctx.can("vacancies.moderate")) return <Forbidden perm="vacancies.moderate" />;
  const sp = await searchParams;
  const tab: ModerationTab = oneOf(param(sp, "tab"), MODERATION_TABS) ?? "review";
  const entity = oneOf(param(sp, "entity"), ["vacancy", "worker"] as const) ?? null;
  const page = parsePage(sp);
  const view = param(sp, "view");
  const [queue, history] = await Promise.all([
    getModerationQueue(tab, entity, page),
    view && /^(vacancy|worker):[0-9a-f-]{36}$/.test(view) ? getModerationHistory(view.split(":")[0] as "vacancy" | "worker", view.split(":")[1]!) : Promise.resolve(null),
  ]);
  const href = (patch: Record<string, string | null>) => {
    const q = new URLSearchParams();
    const merged = { tab, entity, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v && !(k === "tab" && v === "review")) q.set(k, v);
    const s = q.toString();
    return s ? `${BASE}?${s}` : BASE;
  };
  const pages = Math.max(1, Math.ceil(queue.total / QUEUE_PAGE));

  return (
    <div>
      <AdminPageHeader title={t("admin.moderation.title")} subtitle={t("admin.moderation.subtitle")} />
      <LinkTabs
        tabs={MODERATION_TABS.map((k) => ({ href: href({ tab: k, page: null, view: null }), label: t(`admin.moderation.tabs.${k}`), count: k in queue.counts ? queue.counts[k] : undefined, active: tab === k }))}
      />
      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        {([null, "vacancy", "worker"] as const).map((e) => (
          <Link key={e ?? "all"} href={href({ entity: e, page: null, view: null })} className={entity === e ? "rounded-lg bg-primary-soft px-3 py-1.5 font-semibold text-primary" : "rounded-lg px-3 py-1.5 text-muted-foreground hover:bg-secondary"}>
            {t(`admin.moderation.entity.${e ?? "all"}`)}
          </Link>
        ))}
      </div>
      <QueryError message={queue.error} />
      {queue.rows.length ? (
        <ul className="space-y-3">
          {queue.rows.map((r) => {
            const key = `${r.entity}:${r.id}`;
            return (
              <li key={key} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge size="sm" variant="primary">{t(`admin.moderation.entity.${r.entity}`)}</Badge>
                      <Badge size="sm" variant={r.state === "rejected" ? "destructive" : r.state === "review" ? "warning" : "default"}>{t(`admin.moderation.states.${r.state}`)}</Badge>
                      {r.category ? <Badge size="sm">{t(`admin.moderation.categories.${r.category}`)}</Badge> : null}
                      {r.appeal_at ? <Badge size="sm" variant="warning">{t("admin.moderation.appeal")}</Badge> : null}
                      {r.attempts > 0 ? <Badge size="sm" variant="destructive">{t("admin.moderation.attempts", { n: r.attempts })}</Badge> : null}
                      {r.owner_blocked ? <Badge size="sm" variant="destructive">{t("admin.users.blocked")}</Badge> : null}
                    </div>
                    <p className="font-semibold [overflow-wrap:anywhere]">
                      {r.entity === "vacancy" ? (
                        <Link href={`/admin/vacancies?q=${r.id}`} className="hover:underline">{r.title || "—"}</Link>
                      ) : (
                        <Link href={`/admin/workers?q=${r.owner_id}`} className="hover:underline">{r.title || "—"}</Link>
                      )}
                    </p>
                    {r.preview ? <p className="whitespace-pre-line text-sm text-muted-foreground line-clamp-4 [overflow-wrap:anywhere]">{r.preview}</p> : null}
                    {r.message ? (
                      <p className="text-sm">
                        <span className="font-medium">{t("admin.moderation.reason")}:</span> {r.message}
                        {r.fields.length ? <span className="text-muted-foreground"> · {t("admin.moderation.fields")}: {r.fields.join(", ")}</span> : null}
                      </p>
                    ) : null}
                    {r.last_check ? (
                      <p className="text-xs text-muted-foreground">
                        {t("admin.moderation.last_check", { source: r.last_check.source, decision: r.last_check.decision })}
                        {r.last_check.reason_code ? ` · ${r.last_check.reason_code}` : ""}
                        {r.last_check.signals?.length ? ` · ${r.last_check.signals.join(", ")}` : ""}
                        {r.last_check.error ? ` · ${r.last_check.error}` : ""} · {formatRelative(r.last_check.created_at, locale)}
                      </p>
                    ) : null}
                    <p className="text-xs text-muted-foreground">
                      {fullName(r.owner_first_name, r.owner_last_name) || r.owner_id.slice(0, 8)} · v{r.version}
                      {r.moderated_version ? ` (${t("admin.moderation.checked_version", { v: r.moderated_version })})` : ""} · <span title={formatDateTime(r.requested_at, locale)}>{formatRelative(r.requested_at, locale)}</span>
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <ModerationActions entity={r.entity} id={r.id} title={r.title || "—"} state={r.state} />
                    <Link href={href({ view: view === key ? null : key, page: page > 1 ? String(page) : null })} className="text-xs font-medium text-primary hover:underline">
                      {view === key ? t("admin.moderation.hide_history") : t("admin.moderation.history")}
                    </Link>
                  </div>
                </div>
                {view === key && history ? (
                  <ol className="mt-3 space-y-1.5 border-t border-border pt-3 text-xs">
                    {history.length ? (
                      history.map((h) => (
                        <li key={h.id} className="flex flex-wrap gap-x-2">
                          <span className="font-mono text-muted-foreground">{formatDateTime(h.created_at, locale)}</span>
                          <span className="font-semibold">v{h.version}</span>
                          <span>{h.source}</span>
                          <span className="font-medium">{h.decision}</span>
                          {h.category ? <span>{h.category}</span> : null}
                          {h.reason_code ? <span className="text-muted-foreground">{h.reason_code}</span> : null}
                          {h.signals.length ? <span className="text-muted-foreground">[{h.signals.join(", ")}]</span> : null}
                          {h.model ? <span className="text-muted-foreground">{h.model}{h.latency_ms ? ` · ${h.latency_ms} ms` : ""}</span> : null}
                          {h.user_message ? <span className="w-full text-muted-foreground">“{h.user_message}”</span> : null}
                          {h.error ? <span className="w-full text-destructive">{h.error}</span> : null}
                        </li>
                      ))
                    ) : (
                      <li className="text-muted-foreground">{t("common.empty.nothing_here")}</li>
                    )}
                  </ol>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState title={t("admin.moderation.empty")} />
      )}
      {pages > 1 ? (
        <div className="mt-4 flex items-center justify-between">
          {page > 1 ? (
            <Button asChild variant="outline" size="sm">
              <Link href={href({ page: String(page - 1) })}>←</Link>
            </Button>
          ) : (
            <span />
          )}
          <span className="text-sm text-muted-foreground">{page} / {pages}</span>
          {page < pages ? (
            <Button asChild variant="outline" size="sm">
              <Link href={href({ page: String(page + 1) })}>→</Link>
            </Button>
          ) : (
            <span />
          )}
        </div>
      ) : null}
    </div>
  );
}
