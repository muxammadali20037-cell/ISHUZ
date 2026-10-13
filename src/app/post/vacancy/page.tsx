import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { getT } from "@/lib/i18n/server";
import { getCategories, getDistricts, getRegions } from "@/lib/reference";
import { getSession } from "@/features/auth/session";
import { aiProviderConfigured } from "@/lib/ai/json";
import { Shell } from "@/components/shared/shell";
import { VacancyPost } from "@/features/post/components/vacancy-post";
import { getEmployerDefaults, getListingDays, getPostViewer, getSimpleListingFeatures, getVacancyPrefill } from "@/features/post/queries";
import { getMode } from "@/features/mode/server";
import { ModeGate } from "@/features/mode/components/mode-gate";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("easy.vacancy.page_title"), robots: { index: false } };
}

/**
 * "Ishchi qidiryapman" — 4 qadamli ish e'loni. ?edit=<id> — mavjud e'lonni o'zgartirish (faqat egasi/menejer).
 * Yangi e'londan oldin foydalanuvchi o'zini tasdiqlaydi ("Ha, menga xodim kerak") — ish izlovchi adashib vakansiya bermaydi.
 */
export default async function PostVacancyPage({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  const [session, mode] = await Promise.all([getSession(), getMode()]);
  if (session?.profile.is_blocked) redirect("/blocked");
  const { edit } = await searchParams;
  const editId = edit && z.uuid().safeParse(edit).success ? edit : null;
  if (!editId && mode !== "employer") {
    return (
      <Shell hideNav>
        <ModeGate variant="post" need="employer" otherHref="/post/worker" />
      </Shell>
    );
  }
  if (editId && !session) redirect(`/auth?next=${encodeURIComponent(`/post/vacancy?edit=${editId}`)}`);
  const [categories, regions, districts, viewer, days, features] = await Promise.all([getCategories(), getRegions(), getDistricts(), getPostViewer(session), getListingDays(), getSimpleListingFeatures()]);
  const prefill = editId && session ? await getVacancyPrefill(session, editId) : await getEmployerDefaults(session);
  if (editId && !prefill) notFound();
  if (!editId && prefill && !prefill.phone && viewer.phone) prefill.phone = viewer.phone;
  return (
    <Shell hideNav>
      <Suspense>
        <VacancyPost categories={categories} regions={regions} districts={districts} viewer={viewer} prefill={prefill ?? {}} editId={editId} pricedDays={days.vacancy} aiEnabled={aiProviderConfigured()} customAllowed={features.customProfession} photoQuarantine={features.photoQuarantine} dailyAllowed={features.dailyJobs} />
      </Suspense>
    </Shell>
  );
}
