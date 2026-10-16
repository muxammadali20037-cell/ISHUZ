import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getT } from "@/lib/i18n/server";
import { requireSession } from "@/features/auth/session";
import { getVacancyBySlug, getVacancyViewerState } from "@/features/jobs/queries";
import { getFitAnalysis } from "@/features/jobs/fit";
import { FitView, FitNoProfile } from "@/features/jobs/components/fit-view";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("jobs.fit.title"), robots: { index: false } };
}

/**
 * /jobs/[slug]/moslik — moslik tahlili (S3): hisoblangan foiz (faqat ma'lumot to'liq va majburiy talablar mos bo'lsa),
 * nima uchun mos, nimaga e'tibor berish kerak, nima yetishmaydi. Faqat kirgan ish izlovchiga (o'z profili bo'yicha).
 */
export default async function FitPage({ params }: Props) {
  const { slug } = await params;
  const session = await requireSession(`/jobs/${encodeURIComponent(slug)}/moslik`);
  const vacancy = await getVacancyBySlug(slug);
  if (!vacancy) notFound();
  const viewer = await getVacancyViewerState(vacancy, session);
  if (viewer.kind === "manager") redirect(`/jobs/${vacancy.slug}`);
  const workerId = session.workerId && session.workerOnboarded ? session.workerId : null;
  if (!workerId) return <FitNoProfile slug={vacancy.slug} title={vacancy.title} />;
  const fit = await getFitAnalysis(workerId, vacancy.id);
  return <FitView slug={vacancy.slug} title={vacancy.title} fit={fit} applied={!!viewer.application} />;
}
