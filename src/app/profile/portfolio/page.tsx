import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { requireWorker } from "@/features/auth/session";
import { Shell } from "@/components/shared/shell";
import { PageHeader } from "@/components/ui/misc";
import { PortfolioManager } from "@/features/profile/components/portfolio/portfolio-manager";
import { getWorkerProfileFull } from "@/features/profile/queries";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("profile.meta.portfolio") };
}

export default async function PortfolioPage() {
  const session = await requireWorker("/profile/portfolio");
  const { t, name } = await getT();
  const data = await getWorkerProfileFull(session.workerId);
  const category = data?.worker.category ?? null;
  return (
    <Shell>
      <div className="container-narrow py-4 sm:py-6">
        <PageHeader title={t("profile.portfolio.title")} subtitle={t("profile.portfolio.subtitle")} backHref="/profile" />
        <PortfolioManager items={data?.portfolio ?? []} userId={session.userId} recommendedCategory={category?.portfolio_recommended ? name(category) : null} />
      </div>
    </Shell>
  );
}
