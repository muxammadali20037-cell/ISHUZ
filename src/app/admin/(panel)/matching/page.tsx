import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { getAdminContext } from "@/features/admin/context";
import { getMatchingSettings } from "@/features/admin/queries/panel";
import { AdminPageHeader, Forbidden } from "@/features/admin/components/notes";
import { MatchingForm } from "@/features/admin/components/matching-form";
import { StatTile } from "@/features/admin/components/stat-tile";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: `${t("admin.nav.matching")} · ${t("admin.shell.title")}` };
}

/** Moslik foizi qoidalari: og'irliklar, avtomatik Telegram chegarasi, versiya. O'zgartirish — audit bilan. */
export default async function AdminMatchingPage() {
  const ctx = await getAdminContext();
  const { t } = await getT();
  if (!ctx.can("analytics.view") && !ctx.can("settings.manage")) return <Forbidden perm="settings.manage" />;
  const s = await getMatchingSettings();
  return (
    <div className="space-y-6">
      <AdminPageHeader title={t("admin.matching.title")} subtitle={t("admin.matching.subtitle")} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <StatTile label={t("admin.matching.version")} value={`v${s.version}`} />
        <StatTile label={t("admin.matching.threshold")} value={`${s.threshold}%`} tone="primary" />
        <StatTile label={t("admin.matching.daily_limit")} value={s.dailyLimit} hint={t("admin.matching.daily_limit_hint")} />
      </div>
      <section className="rounded-2xl border border-border bg-card p-4">
        <MatchingForm weights={s.weights} threshold={s.threshold} canManage={ctx.can("settings.manage")} />
      </section>
      <section className="space-y-2 rounded-2xl bg-secondary p-4 text-sm">
        <h2 className="font-semibold">{t("admin.matching.rules_title")}</h2>
        <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
          <li>{t("admin.matching.rule_hard")}</li>
          <li>{t("admin.matching.rule_unknown")}</li>
          <li>{t("admin.matching.rule_salary")}</li>
          <li>{t("admin.matching.rule_notify")}</li>
          <li>{t("admin.matching.rule_no_resend")}</li>
        </ul>
      </section>
    </div>
  );
}
