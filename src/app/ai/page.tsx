import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getT } from "@/lib/i18n/server";
import { getSession } from "@/features/auth/session";
import { Shell } from "@/components/shared/shell";
import { AiHub } from "@/features/ai/components/ai-hub";
import { getMode } from "@/features/mode/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("easy.aihub.title"), robots: { index: false } };
}

/** /ai — pastki menyudagi "AI": aqlli qidiruv, sizga mos e'lonlar, AI PRO, AI bilan e'lon tuzish (mehmon ham ko'radi) */
export default async function AiPage({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const [session, mode, params] = await Promise.all([getSession(), getMode(), searchParams]);
  if (session?.profile.is_blocked) redirect("/blocked");
  // ?q= — bosh sahifadagi qidiruv maydonidan (sahifa to'liq yuklanmasdan "Topish" bosilganda): savol shu yerda o'zi yuboriladi
  const q = typeof params.q === "string" ? params.q.replace(/\s+/g, " ").trim().slice(0, 300) : "";
  return (
    <Shell>
      <AiHub session={session} mode={mode} query={q.length >= 2 ? q : undefined} />
    </Shell>
  );
}
