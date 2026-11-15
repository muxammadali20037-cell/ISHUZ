import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getT } from "@/lib/i18n/server";
import { getSession } from "@/features/auth/session";
import { Shell } from "@/components/shared/shell";
import { AiWorkspace } from "@/features/ai/components/ai-workspace";
import { getMode } from "@/features/mode/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("easy.aiws.title"), robots: { index: false } };
}

/** /ai — "Yordamchi": suhbat, bugungi ishlar, mos e'lonlar, tezkor imkoniyatlar (mehmon ham ko'radi); alohida to'liq ekran */
export default async function AiPage({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const [session, mode, params] = await Promise.all([getSession(), getMode(), searchParams]);
  if (session?.profile.is_blocked) redirect("/blocked");
  // ?q= — bosh sahifadagi qidiruv maydonidan (sahifa to'liq yuklanmasdan "Topish" bosilganda): savol shu yerda o'zi yuboriladi
  const q = typeof params.q === "string" ? params.q.replace(/\s+/g, " ").trim().slice(0, 300) : "";
  return (
    // alohida to'liq ekran: yuqori panel va menyular yo'q — o'z sarlavhasi ("‹", "Yordamchi") bor (ega, 2026-11-15)
    <Shell bare>
      <AiWorkspace session={session} mode={mode} query={q.length >= 2 ? q : undefined} />
    </Shell>
  );
}
