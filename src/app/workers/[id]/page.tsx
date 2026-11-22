import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { requireEmployer } from "@/features/auth/session";
import { getT } from "@/lib/i18n/server";
import { getBenefits } from "@/lib/reference";
import { shortName } from "@/lib/format";
import { Shell } from "@/components/shared/shell";
import { ContactCard } from "@/features/contacts/contact-card";
import {
  getCandidate,
  getCandidateInteractions,
  getCandidateRating,
  getCandidateReviews,
  getContactFlags,
  getManagedVacancy,
  getSavedEntry,
  getSavedFolders,
  recordWorkerView,
} from "@/features/workers/queries";
import { CandidateHeader } from "@/features/workers/components/candidate-header";
import {
  AboutSection,
  EducationSection,
  ExperienceSection,
  LanguagesSection,
  LocationSection,
  PreferencesSection,
  RatingSection,
  SkillsSection,
} from "@/features/workers/components/candidate-sections";
import { PortfolioGallery } from "@/features/workers/components/portfolio-gallery";
import { CandidateActions } from "@/features/workers/components/candidate-actions";

type Params = Promise<{ id: string }>;
type Search = Promise<{ vacancy?: string | string[] }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { t } = await getT();
  const { id } = await params;
  const candidate = await getCandidate(id);
  const title = candidate ? `${shortName(candidate.first_name, candidate.last_initial)}${candidate.headline ? ` — ${candidate.headline}` : ""}` : t("workers.meta.candidate_title");
  return { title, robots: { index: false } };
}

/** /workers/[id] — nomzod profili (ish beruvchi uchun). Faqat viloyat/tuman; koordinata hech qachon ko'rsatilmaydi. */
export default async function CandidatePage({ params, searchParams }: { params: Params; searchParams: Search }) {
  const { id } = await params;
  const session = await requireEmployer(`/workers/${id}`);
  const sp = await searchParams;
  const vacancyParam = typeof sp.vacancy === "string" ? sp.vacancy : null;

  const candidate = await getCandidate(id);
  if (!candidate) notFound();

  const [{ t }, vacancy, interactions, saved, folders, rating, reviews, contact, officialTermBenefits] = await Promise.all([
    getT(),
    getManagedVacancy(vacancyParam, session),
    getCandidateInteractions(candidate.id, session.userId),
    getSavedEntry(candidate.id, session.userId),
    getSavedFolders(session.userId),
    getCandidateRating(candidate.profile_id),
    getCandidateReviews(candidate.profile_id),
    getContactFlags(candidate.profile_id),
    getBenefits("official_term"),
    recordWorkerView(candidate.id),
  ]);
  const officialTerms = (candidate.preferences?.official_terms ?? []).map((code) => officialTermBenefits.find((b) => b.code === code)).filter((b): b is NonNullable<typeof b> => !!b);
  const workerName = shortName(candidate.first_name, candidate.last_initial);
  const backHref = vacancy ? `/workers?vacancy=${vacancy.id}` : "/workers";

  return (
    <Shell>
      <div className="container-app py-4 pb-28 md:py-6 md:pb-8">
        <Link href={backHref} data-page-back className="mb-3 inline-flex h-10 items-center gap-1 rounded-xl pr-3 text-sm font-medium text-muted-foreground hover:text-foreground">
          <ChevronLeft className="size-5" /> {t("workers.candidate.back")}
        </Link>
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_340px] md:gap-6">
          <div className="space-y-4">
            <CandidateHeader candidate={candidate} phoneVerified={contact.phoneVerified} />
            <AboutSection about={candidate.about} />
            <LocationSection region={candidate.region} district={candidate.district} workDistricts={candidate.work_districts} remotePreference={candidate.remote_preference} />
            <ExperienceSection items={candidate.experience} />
            <SkillsSection skills={candidate.skills} />
            <LanguagesSection languages={candidate.languages} />
            <EducationSection items={candidate.education} />
            <PortfolioGallery items={candidate.portfolio} />
            <PreferencesSection preferences={candidate.preferences} workFormat={candidate.work_format} officialTerms={officialTerms} />
            <RatingSection rating={rating} reviews={reviews} />
            <div className="md:hidden">
              <ContactCard profileId={candidate.profile_id} />
            </div>
          </div>
          <aside className="space-y-4 md:sticky md:top-20 md:self-start">
            <CandidateActions
              workerId={candidate.id}
              workerName={workerName}
              profileId={candidate.profile_id}
              chatHref={interactions.chatHref}
              saved={saved}
              folders={folders}
            />
            <div className="hidden md:block">
              <ContactCard profileId={candidate.profile_id} />
            </div>
          </aside>
        </div>
      </div>
    </Shell>
  );
}
