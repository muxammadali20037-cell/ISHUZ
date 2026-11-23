import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { DEFAULT_OG_IMAGE, localeAlternates } from "@/lib/seo";
import { getSession } from "@/features/auth/session";
import { Shell } from "@/components/shared/shell";
import { cookies } from "next/headers";
import { StartChat, StartHome } from "@/features/start-chat/components/start-chat";
import { redirect } from "next/navigation";
import { INTRO_COOKIE } from "@/features/start-chat/intro";
import { listingImageEnabled } from "@/features/listing-image/server";
import { homeData } from "@/features/start-chat/home";
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
 * Bosh sahifa (ega, 2026-11-21: "reklama sahifasi kerak emas"; 2026-11-23: pastki menyuda "Bosh sahifa" — mehmon ham, kirgan
 * foydalanuvchi ham): sarlavha, qidiruv qatori, uchta tugma, tezkor bo'limlar va eng yangi e'lonlar. Suhbat — /chat da.
 * Qidiruv tizimlari uchun sarlavha, tavsif va pastki qism (sayt haqida, havolalar) — o'z joyida.
 */
export default async function HomePage({ searchParams }: { searchParams: Promise<{ q?: string | string[]; post?: string | string[]; region?: string | string[] }> }) {
  // yo'naltirishlar (bloklangan, kirish oqimi) — (home)/layout.tsx da
  const [session, mode, params, jar] = await Promise.all([getSession(), getMode(), searchParams, cookies()]);
  // eski havolalar va skriptlarsiz yuborilgan matn (?q=, ?post=) — suhbat endi /chat da ("Qidiruv")
  if (typeof params.q === "string" || typeof params.post === "string") {
    const qs = new URLSearchParams();
    for (const k of ["q", "post", "region"] as const) if (typeof params[k] === "string") qs.set(k, params[k]);
    redirect(`/chat?${qs}`);
  }
  const home = await homeData(mode, session, (name) => jar.get(name)?.value);
  const introSeen = jar.get(INTRO_COOKIE)?.value === "1";
  return (
    <Shell footer={<SiteFooter compact={!!session} />}>
      {home ? (
        // Bosh sahifa (2026-11-23): faqat bosh ekran — qidiruv va tugmalar "Qidiruv" (/chat) da yangi suhbat ochadi
        <StartHome mode={mode} home={home} introSeen={introSeen} imageEnabled={listingImageEnabled()} />
      ) : (
        // bosh ekran ma'lumoti o'qilmadi (texnik xato) — avvalgi chat ekrani, sahifa yiqilmaydi
        <StartChat mode={mode} owner={session?.userId ?? "guest"} introSeen={introSeen} imageEnabled={listingImageEnabled()} home={null} />
      )}
    </Shell>
  );
}
