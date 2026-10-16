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
export default async function AiPage() {
  const [session, mode] = await Promise.all([getSession(), getMode()]);
  if (session?.profile.is_blocked) redirect("/blocked");
  return (
    <Shell>
      <AiHub session={session} mode={mode} />
    </Shell>
  );
}
