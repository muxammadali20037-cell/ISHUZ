import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getT } from "@/lib/i18n/server";
import { getSession } from "@/features/auth/session";
import { getMode } from "@/features/mode/server";
import { Shell } from "@/components/shared/shell";
import { StartChat } from "@/features/start-chat/components/start-chat";
import { chatQuery } from "@/features/start-chat/query";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("easy.start_chat.title"), robots: { index: false } };
}

/**
 * /chat — asosiy ekran (pastki menyuning "Qidiruv" bo'limi; mehmon uchun "/" ham shu chat). AI maqsadni yozilgan matndan
 * o'zi aniqlaydi (ega, 2026-11-21); rejim faqat salom matni va misollar uchun (rejimi yo'q mehmon — "Ish kerakmi yoki ishchi?").
 */
export default async function ChatPage({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const [session, mode, params] = await Promise.all([getSession(), getMode(), searchParams]);
  if (session?.profile.is_blocked) redirect("/blocked");
  return (
    <Shell>
      <StartChat mode={mode} owner={session?.userId ?? "guest"} initialQuery={chatQuery(params.q)} />
    </Shell>
  );
}
