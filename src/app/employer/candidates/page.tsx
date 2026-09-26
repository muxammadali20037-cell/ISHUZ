import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireEmployer } from "@/features/auth/session";
import { getT } from "@/lib/i18n/server";
import { Shell } from "@/components/shared/shell";
import { getMyVacancies } from "@/features/workers/queries";
import { CandidatesPicker } from "@/features/workers/components/candidates-picker";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("workers.meta.candidates_title"), robots: { index: false } };
}

/**
 * /employer/candidates — faol vakansiya bo'lsa eng yangisiga (/workers?vacancy=) yo'naltiradi;
 * bo'lmasa vakansiya tanlash sahifasi / bo'sh holat.
 */
export default async function CandidatesPage() {
  const session = await requireEmployer("/employer/candidates");
  const vacancies = await getMyVacancies(session);
  const active = vacancies.find((v) => v.status === "active");
  if (active) redirect(`/workers?vacancy=${active.id}`);
  return (
    <Shell>
      <CandidatesPicker vacancies={vacancies} />
    </Shell>
  );
}
