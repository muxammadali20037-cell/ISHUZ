import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSession } from "@/features/auth/session";
import { JobPostingJsonLd } from "@/features/jobs/components/job-posting-jsonld";
import { VacancyDetail } from "@/features/jobs/components/vacancy-detail";
import { vacancyMetadata } from "@/features/jobs/metadata";
import { getVacancyBySlug, getVacancyViewerState, recordVacancyView } from "@/features/jobs/queries";
import { getT } from "@/lib/i18n/server";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const vacancy = await getVacancyBySlug(slug);
  if (!vacancy) {
    const { t } = await getT();
    return { title: t("common.errors.not_found"), robots: { index: false } };
  }
  return vacancyMetadata(vacancy);
}

/** /jobs/[slug] — ommaviy (faol vakansiya); boshqa holatlar faqat boshqaruvchiga (RLS), aks holda 404 */
export default async function VacancyPage({ params }: Props) {
  const { slug } = await params;
  const [vacancy, session] = await Promise.all([getVacancyBySlug(slug), getSession()]);
  if (!vacancy) notFound();
  const viewer = await getVacancyViewerState(vacancy, session);
  if (viewer.kind !== "manager") await recordVacancyView(vacancy.id);
  return (
    <>
      <JobPostingJsonLd vacancy={vacancy} />
      <VacancyDetail vacancy={vacancy} viewer={viewer} session={session} />
    </>
  );
}
