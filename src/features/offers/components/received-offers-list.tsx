import { Gift, Inbox } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { getReceivedOffers } from "../queries";
import { isOfferPending, type OffersTab } from "../types";
import { OfferCard } from "./offer-card";
import { OffersTabs } from "./offers-tabs";

/** /offers (ishchi) — kelgan takliflar: Yangi / Javob berilgan */
export async function ReceivedOffersList({ workerId, tab }: { workerId: string; tab: OffersTab }) {
  const { t } = await getT();
  const all = await getReceivedOffers(workerId);
  const pending = all.filter((o) => isOfferPending(o.status));
  const answered = all.filter((o) => !isOfferPending(o.status));
  const items = tab === "new" ? pending : answered;
  return (
    <div className="container-narrow py-5 sm:py-8">
      <PageHeader title={t("offers.meta.title")} subtitle={pending.length ? t("offers.list.pending_count", { count: pending.length }) : undefined} />
      <OffersTabs active={tab} counts={{ new: pending.length, answered: answered.length }} />
      <div className="mt-4 space-y-3">
        {items.length ? (
          items.map((o) => <OfferCard key={o.id} offer={o} />)
        ) : tab === "new" ? (
          <EmptyState icon={Gift} title={t("offers.list.empty_title")} description={t("offers.list.empty_desc")} action={{ label: t("offers.list.empty_cta"), href: "/profile" }} />
        ) : (
          <EmptyState icon={Inbox} title={t("offers.list.answered_empty_title")} description={t("offers.list.answered_empty_desc")} />
        )}
      </div>
    </div>
  );
}
