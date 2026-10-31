import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSession } from "@/features/auth/session";
import { ClosedVacancy } from "@/features/jobs/components/closed-vacancy";
import { JobPostingJsonLd } from "@/features/jobs/components/job-posting-jsonld";
import { VacancyDetail } from "@/features/jobs/components/vacancy-detail";
import { vacancyMetadata } from "@/features/jobs/metadata";
import { getVacancyBySlug, getVacancyStub, getVacancyViewerState, recordVacancyView } from "@/features/jobs/queries";
import { getT } from "@/lib/i18n/server";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const vacancy = await getVacancyBySlug(slug);
  if (!vacancy) {
    const [{ t }, stub] = await Promise.all([getT(), getVacancyStub(slug)]);
    if (stub) return { title: t("jobs.closed.meta_title", { title: stub.title }), robots: { index: false, follow: true } };
    return { title: t("common.errors.not_found"), robots: { index: false } };
  }
  return vacancyMetadata(vacancy);
}

/**
 * /jobs/[slug] — ommaviy (faol vakansiya); boshqa holatlar boshqaruvchiga (RLS). Avval ommaviy bo'lib, keyin yopilgan /
 * muddati o'tgan / to'xtatilgan vakansiya — "yopilgan" sahifasi (0069, noindex); umuman bo'lmagani — 404.
 */
export default async function VacancyPage({ params }: Props) {
  const { slug } = await params;
  const [vacancy, session] = await Promise.all([getVacancyBySlug(slug), getSession()]);
  if (!vacancy) {
    const stub = await getVacancyStub(slug);
    if (!stub) notFound();
    return <ClosedVacancy stub={stub} />;
  }
  const [viewer, { t }] = await Promise.all([getVacancyViewerState(vacancy, session), getT()]);
  if (viewer.kind !== "manager") await recordVacancyView(vacancy.id);
  return (
    <>
      <JobPostingJsonLd vacancy={vacancy} privateEmployerLabel={t("jobs.closed.private_employer")} />
      <VacancyDetail vacancy={vacancy} viewer={viewer} session={session} />
    </>
  );
}
