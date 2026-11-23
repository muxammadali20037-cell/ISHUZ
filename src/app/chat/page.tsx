import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getT } from "@/lib/i18n/server";
import { getSession } from "@/features/auth/session";
import { getMode } from "@/features/mode/server";
import { Shell } from "@/components/shared/shell";
import { cookies } from "next/headers";
import { StartChat } from "@/features/start-chat/components/start-chat";
import { INTRO_COOKIE } from "@/features/start-chat/intro";
import { listingImageEnabled } from "@/features/listing-image/server";
import { chatQuery } from "@/features/start-chat/query";
import { homeData } from "@/features/start-chat/home";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("easy.start_chat.title"), robots: { index: false } };
}

/**
 * /chat — suhbat (pastki menyuning "Qidiruv" bo'limi; "/" — Bosh sahifa, u yerdagi qidiruv va tugmalar shu yerda ?from=home
 * bilan yangi suhbat bo'lib davom etadi). AI maqsadni yozilgan matndan
 * o'zi aniqlaydi (ega, 2026-11-21); rejim faqat salom matni va misollar uchun (rejimi yo'q mehmon — "Ish kerakmi yoki ishchi?").
 */
export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[]; post?: string | string[]; region?: string | string[]; start?: string | string[]; from?: string | string[] }>;
}) {
  const [session, mode, params, jar] = await Promise.all([getSession(), getMode(), searchParams, cookies()]);
  if (session?.profile.is_blocked) redirect("/blocked");
  return (
    <Shell>
      <StartChat
        mode={mode}
        owner={session?.userId ?? "guest"}
        initialQuery={chatQuery(params.q)}
        post={params.post === "1" ? "resume" : params.post === "new" ? "new" : params.post === "offer" ? "offer" : null}
        introSeen={jar.get(INTRO_COOKIE)?.value === "1"}
        imageEnabled={listingImageEnabled()}
        home={await homeData(mode, session, (name) => jar.get(name)?.value)}
        initialRegion={typeof params.region === "string" ? params.region : null}
        initialStart={params.start === "jobs" || params.start === "workers" ? params.start : null}
        fromHome={params.from === "home"}
      />
    </Shell>
  );
}
