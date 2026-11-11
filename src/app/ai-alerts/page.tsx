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
export default async function AiAlertsPage({ searchParams }: { searchParams: Promise<{ role?: string; q?: string }> }) {
  const params = await searchParams;
  // ?q= — AI qidiruv hech narsa topmaganda: foydalanuvchi yozgan matn kuzatuv formasida tayyor turadi
  const q = typeof params.q === "string" ? params.q.slice(0, 300) : "";
  const back = new URLSearchParams();
  if (params.role === "employer" || params.role === "worker") back.set("role", params.role);
  if (q) back.set("q", q);
  const session = await requireSession(`/ai-alerts${back.size ? `?${back}` : ""}`);
  // tanlanmagan bo'lsa: faqat ish beruvchi bo'lgan foydalanuvchiga — ishchi qidirish, qolganlarga — ish qidirish
  const role = params.role === "employer" || params.role === "worker" ? params.role : session.employerId && !session.workerId ? "employer" : "worker";
  const [{ t }, data] = await Promise.all([getT(), getAiAlertsData(session.userId)]);
  return (
    <div className="container-narrow py-5 sm:py-8">
      <PageHeader title={t("saved.ai_alerts.title")} subtitle={t(role === "employer" ? "saved.ai_alerts.subtitle_employer" : "saved.ai_alerts.subtitle")} backHref="/" />
      <AiAlertsPanel data={data} role={role} initialText={q} />
    </div>
  );
}
