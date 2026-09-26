import type { Metadata } from "next";
import { UserPlus } from "lucide-react";
import { requireSession } from "@/features/auth/session";
import { getT } from "@/lib/i18n/server";
import { Shell } from "@/components/shared/shell";
import { EmptyState } from "@/components/ui/misc";
import { ReceivedOffersList } from "@/features/offers/components/received-offers-list";
import { SentOffersList } from "@/features/offers/components/sent-offers-list";
import { isOffersTab } from "@/features/offers/types";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("offers.meta.title") };
}

/**
 * /offers — ishchi rejimida kelgan takliflar (?tab=new|answered), ish beruvchi rejimida yuborilganlar.
 * Rol: active_role; u bo'lmasa — qaysi profil bor bo'lsa.
 */
export default async function OffersPage({ searchParams }: { searchParams: Promise<{ tab?: string | string[] }> }) {
  const session = await requireSession("/offers");
  const { t } = await getT();
  const sp = await searchParams;
  const raw = Array.isArray(sp.tab) ? sp.tab[0] : sp.tab;
  const tab = isOffersTab(raw) ? raw : "new";
  const employerView = session.activeRole === "employer" || (session.activeRole === null && !!session.employerId && !session.workerId);

  if (employerView) {
    return (
      <Shell forceRole="employer">
        {session.employerId ? (
          <SentOffersList userId={session.userId} />
        ) : (
          <div className="container-narrow py-10">
            <EmptyState icon={UserPlus} title={t("offers.list.employer_profile_required_title")} description={t("offers.list.employer_profile_required_desc")} action={{ label: t("offers.list.employer_profile_required_cta"), href: "/onboarding/employer" }} />
          </div>
        )}
      </Shell>
    );
  }

  return (
    <Shell forceRole="worker">
      {session.workerId ? (
        <ReceivedOffersList workerId={session.workerId} tab={tab} />
      ) : (
        <div className="container-narrow py-10">
          <EmptyState icon={UserPlus} title={t("offers.list.worker_profile_required_title")} description={t("offers.list.worker_profile_required_desc")} action={{ label: t("offers.list.worker_profile_required_cta"), href: "/onboarding/worker" }} />
        </div>
      )}
    </Shell>
  );
}
