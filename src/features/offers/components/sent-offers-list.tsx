import { Send } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { getSentOffers } from "../queries";
import { SentOfferCard } from "./sent-offer-card";

/** /offers (ish beruvchi) — yuborilgan takliflar */
export async function SentOffersList({ userId }: { userId: string }) {
  const { t } = await getT();
  const items = await getSentOffers(userId);
  return (
    <div className="container-app py-5 sm:py-8">
      <PageHeader title={t("offers.list.sent_title")} subtitle={items.length ? t("common.labels.results", { count: items.length }) : undefined} />
      <div className="grid gap-3 md:grid-cols-2">
        {items.length ? (
          items.map((o) => <SentOfferCard key={o.id} offer={o} canWithdraw={o.employer_profile_id === userId} />)
        ) : (
          <EmptyState icon={Send} title={t("offers.list.sent_empty_title")} description={t("offers.list.sent_empty_desc")} action={{ label: t("offers.list.sent_empty_cta"), href: "/workers" }} className="md:col-span-2" />
        )}
      </div>
    </div>
  );
}
