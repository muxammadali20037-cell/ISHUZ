import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getT } from "@/lib/i18n/server";
import { getCategories, getDistricts, getRegions } from "@/lib/reference";
import { getSession } from "@/features/auth/session";
import { aiProviderConfigured } from "@/lib/ai/json";
import { Shell } from "@/components/shared/shell";
import { WorkerPost } from "@/features/post/components/worker-post";
import { getListingDays, getPostViewer, getSimpleListingFeatures, getWorkerPrefill } from "@/features/post/queries";
import { getMode } from "@/features/mode/server";
import { ModeGate } from "@/features/mode/components/mode-gate";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("easy.worker.page_title"), robots: { index: false } };
}

/**
 * "Ish qidiryapman" — 4 qadamli e'lon. Kirish talab qilinmaydi: hisob faqat joylash paytida so'raladi.
 * Avval foydalanuvchi o'zini tasdiqlaydi ("Ha, men ish qidiryapman") — ish beruvchi adashib o'zi haqida e'lon bermaydi.
 */
export default async function PostWorkerPage() {
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
    getWorkerPrefill(session),
    getListingDays(),
    getSimpleListingFeatures(),
  ]);
  return (
    <Shell hideNav>
      <Suspense>
        <WorkerPost categories={categories} regions={regions} districts={districts} viewer={viewer} prefill={prefill.draft} existing={prefill.existing} pricedDays={days.worker} aiEnabled={aiProviderConfigured()} customAllowed={features.customProfession} />
      </Suspense>
    </Shell>
  );
}
