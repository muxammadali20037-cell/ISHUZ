import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime, formatMoney } from "@/lib/format";
import { getAdminContext } from "@/features/admin/context";
import { AdminPageHeader, Forbidden, QueryError } from "@/features/admin/components/notes";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/misc";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: `${t("admin.nav.payments")} · ${t("admin.shell.title")}` };
}

/** To'lovlar: oxirgi 200 ta + jami tushum (RLS: settings.manage ruxsati) */
export default async function AdminPaymentsPage() {
  const ctx = await getAdminContext();
  if (!ctx.can("settings.manage")) return <Forbidden perm="settings.manage" />;
  const { t, locale } = await getT();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payments")
    .select("id, order_no, purpose, amount, status, provider, created_at, paid_at")
    .order("created_at", { ascending: false })
    .limit(200);
  const rows = data ?? [];
  const paid = rows.filter((r) => r.status === "paid");
  const stats = [
    { label: t("admin.payments.total_paid"), value: formatMoney(paid.reduce((s, r) => s + r.amount, 0), locale) },
    { label: t("admin.payments.count_paid"), value: String(paid.length) },
    { label: t("admin.payments.count_pending"), value: String(rows.filter((r) => r.status === "pending").length) },
  ];
  const tone = { paid: "success", pending: "warning", cancelled: "default", failed: "destructive" } as const;

  return (
    <div>
      <AdminPageHeader title={t("admin.payments.title")} subtitle={t("admin.payments.subtitle")} />
      <QueryError message={error?.message ?? null} />
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className="mt-1 text-xl font-bold tabular">{s.value}</p>
          </div>
        ))}
      </div>
      {rows.length ? (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-secondary/60 text-left text-xs text-muted-foreground">
              <tr>
                {["order", "purpose", "amount", "provider", "status", "date"].map((h) => (
                  <th key={h} className="px-4 py-2.5 font-medium">
                    {t(`admin.payments.${h}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-2.5 font-mono tabular">#{r.order_no}</td>
                  <td className="px-4 py-2.5">{t(`admin.payments.purposes.${r.purpose}`)}</td>
                  <td className="px-4 py-2.5 font-semibold tabular">{formatMoney(r.amount, locale)}</td>
                  <td className="px-4 py-2.5 capitalize">{r.provider ?? "—"}</td>
                  <td className="px-4 py-2.5">
                    <Badge variant={tone[r.status]} size="sm">
                      {t(`admin.payments.statuses.${r.status}`)}
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap text-muted-foreground">{formatDateTime(r.paid_at ?? r.created_at, locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState title={t("common.empty.nothing_here")} />
      )}
    </div>
  );
}
