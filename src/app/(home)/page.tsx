import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { DEFAULT_OG_IMAGE, localeAlternates } from "@/lib/seo";
import { getSession } from "@/features/auth/session";
import { Shell } from "@/components/shared/shell";
import { StartChat } from "@/features/start-chat/components/start-chat";
import { chatQuery } from "@/features/start-chat/query";
import { getMode } from "@/features/mode/server";
import { SiteFooter } from "@/features/landing/market/site-footer";
import { BRAND } from "@/config/brand";

/** sahifa openGraph'i layout'dagini to'liq almashtiradi — tur, sayt nomi va til shu yerda ham */
const OG_LOCALE = { uz: "uz_UZ", oz: "uz_UZ", ru: "ru_RU", en: "en_US" } as const;

export async function generateMetadata(): Promise<Metadata> {
  const { t, locale } = await getT();
  const title = t("welcome.market.meta_title");
  const description = t("welcome.market.meta_description");
  // parametrli manzil (utm va h.k.) — o'sha sahifa: canonical doim parametrsiz
  return { title: { absolute: title }, description, alternates: localeAlternates("/", locale), openGraph: { type: "website", siteName: BRAND.name, locale: OG_LOCALE[locale], title, description, url: "/", images: [DEFAULT_OG_IMAGE] } };
}

/**
 * Bosh sahifa — darhol chat (ega, 2026-11-21: "reklama sahifasi kerak emas, kirgan zahoti chat"). Mehmonga: "Ish kerakmi
 * yoki ishchi? Yozing — topib beramiz."; AI maqsadni o'zi aniqlaydi. Kirgan foydalanuvchi — /chat (layout yo'naltiradi).
 * Qidiruv tizimlari uchun sarlavha, tavsif va pastki qism (sayt haqida, havolalar) — o'z joyida.
 */
export default async function HomePage({ searchParams }: { searchParams: Promise<{ q?: string | string[]; post?: string | string[] }> }) {
  // yo'naltirishlar (bloklangan, kirish oqimi, kirgan foydalanuvchi) — (home)/layout.tsx da
  const [session, mode, params] = await Promise.all([getSession(), getMode(), searchParams]);
  return (
    <Shell footer={<SiteFooter compact={!!session} />}>
      <StartChat mode={mode} owner={session?.userId ?? "guest"} initialQuery={chatQuery(params.q)} post={params.post === "1" ? "resume" : params.post === "new" ? "new" : null} />
    </Shell>
  );
}
