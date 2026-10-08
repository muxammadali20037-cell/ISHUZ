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

/**
 * /ai-alerts — AI yordamchi (PRO): o'z so'zi bilan yozadi, mos e'lon chiqishi bilan Telegram'ga xabar.
 * ?role=worker — "Menga ish topsin" (mos vakansiya), ?role=employer — "Menga ishchi topsin" (mos ishchi e'loni).
 */
export default async function AiAlertsPage({ searchParams }: { searchParams: Promise<{ role?: string }> }) {
  const params = await searchParams;
  const session = await requireSession(`/ai-alerts${params.role === "employer" ? "?role=employer" : params.role === "worker" ? "?role=worker" : ""}`);
  // tanlanmagan bo'lsa: faqat ish beruvchi bo'lgan foydalanuvchiga — ishchi qidirish, qolganlarga — ish qidirish
  const role = params.role === "employer" || params.role === "worker" ? params.role : session.employerId && !session.workerId ? "employer" : "worker";
  const [{ t }, data] = await Promise.all([getT(), getAiAlertsData(session.userId)]);
  return (
    <div className="container-narrow py-5 sm:py-8">
      <PageHeader title={t("saved.ai_alerts.title")} subtitle={t(role === "employer" ? "saved.ai_alerts.subtitle_employer" : "saved.ai_alerts.subtitle")} backHref="/" />
      <AiAlertsPanel data={data} role={role} />
    </div>
  );
}
