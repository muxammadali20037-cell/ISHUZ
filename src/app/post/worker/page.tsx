import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { getT } from "@/lib/i18n/server";
import { getCategories, getDistricts, getRegions } from "@/lib/reference";
import { getSession } from "@/features/auth/session";
import { Shell } from "@/components/shared/shell";
import { WorkerPost } from "@/features/post/components/worker-post";
import { getListingDays, getPostViewer, getSimpleListingFeatures, getWorkerPrefill } from "@/features/post/queries";
import { getMode } from "@/features/mode/server";
import { ModeGate } from "@/features/mode/components/mode-gate";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("easy.worker.page_title"), robots: { index: false } };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * "Ish qidiryapman" — 4 qadamli e'lon. Kirish talab qilinmaydi: hisob faqat joylash paytida so'raladi.
 * Avval foydalanuvchi o'zini tasdiqlaydi ("Ha, men ish qidiryapman") — ish beruvchi adashib o'zi haqida e'lon bermaydi.
 * 0086 (ega, 2026-11-20: "10 ta, 100 ta e'lon joylasin"): ?new=1 — yana bitta e'lon (bo'sh forma); ?listing=<id> — o'z
 * e'lonlaridan birini tahrirlash. Parametrsiz — asosiy e'lon (avvalgidek).
 */
export default async function PostWorkerPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const listingParam = typeof params.listing === "string" ? params.listing : null;
  if (listingParam !== null && !UUID.test(listingParam)) notFound();
  const newListing = !listingParam && params.new === "1";
  const [session, mode] = await Promise.all([getSession(), getMode()]);
  if (session?.profile.is_blocked) redirect("/blocked");
  if (mode !== "worker") {
    return (
      <Shell hideNav>
        <ModeGate variant="post" need="worker" otherHref="/post/vacancy" />
      </Shell>
    );
  }
  const [categories, regions, districts, viewer, prefill, days, features] = await Promise.all([
    getCategories(),
    getRegions(),
    getDistricts(),
    getPostViewer(session),
    getWorkerPrefill(session, { listingId: listingParam, newListing }),
    getListingDays(),
    getSimpleListingFeatures(),
  ]);
  // begona yoki yo'q e'lon; kirmagan mehmon — avval kirish (keyin shu e'longa qaytadi)
  if (listingParam && !session) redirect(`/auth?next=${encodeURIComponent(`/post/worker?listing=${listingParam}`)}`);
  if (!prefill) notFound();
  return (
    <Shell hideNav>
      <Suspense>
        <WorkerPost
          categories={categories}
          regions={regions}
          districts={districts}
          viewer={viewer}
          prefill={prefill.draft}
          existing={prefill.existing}
          pricedDays={days.worker}
          customAllowed={features.customProfession}
          listingId={listingParam}
          newListing={newListing}
        />
      </Suspense>
    </Shell>
  );
}
