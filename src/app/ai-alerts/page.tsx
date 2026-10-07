import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { requireSession } from "@/features/auth/session";
import { PageHeader } from "@/components/ui/misc";
import { getAiAlertsData } from "@/features/ai-alerts/queries";
import { AiAlertsPanel } from "@/features/ai-alerts/components/ai-alerts-panel";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("saved.ai_alerts.title"), robots: { index: false } };
}

/** /ai-alerts — Aqlli AI qidiruv (PRO): o'z so'zi bilan yozadi, mos vakansiya chiqishi bilan Telegram'ga xabar */
export default async function AiAlertsPage() {
  const session = await requireSession("/ai-alerts");
  const [{ t }, data] = await Promise.all([getT(), getAiAlertsData(session.userId)]);
  return (
    <div className="container-narrow py-5 sm:py-8">
      <PageHeader title={t("saved.ai_alerts.title")} subtitle={t("saved.ai_alerts.subtitle")} backHref="/" />
      <AiAlertsPanel data={data} />
    </div>
  );
}
