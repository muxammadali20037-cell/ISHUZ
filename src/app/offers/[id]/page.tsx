import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireSession } from "@/features/auth/session";
import { getT } from "@/lib/i18n/server";
import { Shell } from "@/components/shared/shell";
import { getOffer, markOfferViewedOnOpen } from "@/features/offers/queries";
import { OfferDetailWorker } from "@/features/offers/components/offer-detail-worker";
import { OfferDetailEmployer } from "@/features/offers/components/offer-detail-employer";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("offers.meta.detail_title") };
}

/** /offers/[id] — tomonlar (RLS): ishchi ko'rinishi yoki ish beruvchi ko'rinishi */
export default async function OfferDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession(`/offers/${id}`);
  let offer = await getOffer(id, session.userId);
  if (!offer) notFound();

  const isWorker = !!session.workerId && offer.worker_id === session.workerId;
  if (isWorker) {
    if (offer.status === "sent") {
      const ok = await markOfferViewedOnOpen(offer.id, offer.status);
      if (ok) offer = { ...offer, status: "viewed", viewed_at: new Date().toISOString() };
    }
    return (
      <Shell forceRole="worker">
        <OfferDetailWorker offer={offer} />
      </Shell>
    );
  }

  return (
    <Shell forceRole="employer">
      <OfferDetailEmployer offer={offer} userId={session.userId} />
    </Shell>
  );
}
