import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getT } from "@/lib/i18n/server";
import { getCategories, getDistricts, getRegions } from "@/lib/reference";
import { getSession } from "@/features/auth/session";
import { Shell } from "@/components/shared/shell";
import { WorkerPost } from "@/features/post/components/worker-post";
import { getListingDays, getPostViewer, getWorkerPrefill } from "@/features/post/queries";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("easy.worker.page_title"), robots: { index: false } };
}

/** "Ish qidiryapman" — 4 qadamli e'lon. Kirish talab qilinmaydi: hisob faqat joylash paytida so'raladi */
export default async function PostWorkerPage() {
  const session = await getSession();
  if (session?.profile.is_blocked) redirect("/blocked");
  const [categories, regions, districts, viewer, prefill, days] = await Promise.all([
    getCategories(),
    getRegions(),
    getDistricts(),
    getPostViewer(session),
    getWorkerPrefill(session),
    getListingDays(),
  ]);
  return (
    <Shell hideNav>
      <Suspense>
        <WorkerPost categories={categories} regions={regions} districts={districts} viewer={viewer} prefill={prefill.draft} existing={prefill.existing} pricedDays={days.worker} />
      </Suspense>
    </Shell>
  );
}
