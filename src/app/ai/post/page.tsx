import type { Metadata } from "next";
import { listingImageEnabled } from "@/features/listing-image/server";
import { redirect } from "next/navigation";
import { getT } from "@/lib/i18n/server";
import { getSession } from "@/features/auth/session";
import { getMode } from "@/features/mode/server";
import { Shell } from "@/components/shared/shell";
import { AiPostClient } from "@/features/find/components/ai-post";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("easy.post_ai.page_title"), robots: { index: false } };
}

/**
 * /ai/post — "+ E'lon joylash" (ega, 2026-11-17): yordamchi bilan ishchi e'loni — kasbni yozadi, kerak bo'lsa variant
 * tanlaydi, oynada ism, hudud, tajriba va telefon, "Tasdiqlash" → ko'rinishi → "Joylash" → avtomatik tekshiruv.
 * Alohida to'liq ekran (yuqori panel va menyular yo'q). Ish beruvchi rejimida — vakansiya joylash sahifasi.
 */
export default async function AiPostPage({ searchParams }: { searchParams: Promise<{ resume?: string | string[]; q?: string | string[] }> }) {
  const [session, mode, params] = await Promise.all([getSession(), getMode(), searchParams]);
  if (session?.profile.is_blocked) redirect("/blocked");
  if (mode === "employer") redirect(session?.employerOnboarded ? "/employer/vacancies/new" : "/post/vacancy");
  return (
    <Shell bare>
      <AiPostClient resume={params.resume === "1" && !!session} initialText={typeof params.q === "string" ? params.q.slice(0, 300) : ""} imageEnabled={listingImageEnabled()} />
    </Shell>
  );
}
