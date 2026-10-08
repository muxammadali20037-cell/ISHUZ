import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format";
import { getAdminContext } from "@/features/admin/context";
import { AdminPageHeader, Forbidden, QueryError } from "@/features/admin/components/notes";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/misc";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: `${t("admin.nav.search")} · ${t("admin.shell.title")}` };
}

/** Qidiruv tahlili: natijasiz qidiruvlar birinchi — sinonim/kasb qo'shish uchun (RPC: analytics.view) */
export default async function AdminSearchPage() {
  const ctx = await getAdminContext();
  if (!ctx.can("analytics.view")) return <Forbidden perm="analytics.view" />;
  const { t, locale } = await getT();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_search_insights", { p_days: 30, p_limit: 100 });
  const rows = data ?? [];

  return (
    <div>
      <AdminPageHeader title={t("admin.search.title")} subtitle={t("admin.search.subtitle")} />
      <QueryError message={error?.message ?? null} />
      <p className="mb-4 text-sm text-muted-foreground">{t("admin.search.hint")}</p>
      {rows.length ? (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-secondary/60 text-left text-xs text-muted-foreground">
              <tr>
                {["query", "scope", "searches", "zero", "last"].map((h) => (
                  <th key={h} className="px-4 py-2.5 font-medium">
                    {t(`admin.search.${h}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => (
                <tr key={`${r.scope}-${r.query_norm}`}>
                  <td className="px-4 py-2.5 font-medium">{r.query_norm}</td>
                  <td className="px-4 py-2.5">{t(`admin.search.scopes.${r.scope}`)}</td>
                  <td className="px-4 py-2.5 tabular">{r.searches}</td>
                  <td className="px-4 py-2.5">
                    <Badge variant={r.zero_results > 0 ? "warning" : "default"} size="sm">
                      {r.zero_results}
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap text-muted-foreground">{formatDateTime(r.last_at, locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState title={t("admin.search.empty")} />
      )}
    </div>
  );
}
