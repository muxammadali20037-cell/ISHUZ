import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { localeAlternates } from "@/lib/seo";
import { getSession } from "@/features/auth/session";
import { Shell } from "@/components/shared/shell";
import { HomePage as Home } from "@/features/landing/home-page";
import { getMode } from "@/features/mode/server";
import { parseLatestTab } from "@/features/landing/market/model";
import { SiteFooter } from "@/features/landing/market/site-footer";
import { BRAND } from "@/config/brand";

/** sahifa openGraph'i layout'dagini to'liq almashtiradi — tur, sayt nomi va til shu yerda ham */
const OG_LOCALE = { uz: "uz_UZ", oz: "uz_UZ", ru: "ru_RU", en: "en_US" } as const;

export async function generateMetadata(): Promise<Metadata> {
  const { t, locale } = await getT();
  const title = t("welcome.market.meta_title");
  const description = t("welcome.market.meta_description");
  // "?ish=" (Yangi ishlar filtri) — o'sha sahifa: canonical doim filtrsiz manzil
  return { title: { absolute: title }, description, alternates: localeAlternates("/", locale), openGraph: { type: "website", siteName: BRAND.name, locale: OG_LOCALE[locale], title, description, url: "/" } };
}

/**
 * Bosh sahifa: qidiruv va haqiqiy e'lonlar darhol (features/landing/home-page). Rejim tanlanmagan mehmon — ish qidiruvchi
 * ko'rinishi; ish beruvchi — o'z paneli.
 * Birinchi ochilishda (robot emas) — avval til va tanishtiruv; oqimni boshlab, profilini tugatmagan — to'xtagan qadamiga
 * (features/entry/flow). Qaytgan foydalanuvchi va to'g'ridan-to'g'ri havolalar (vakansiya, qidiruv) — hech qachon.
 */
export default async function HomePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  // yo'naltirishlar (bloklangan, birinchi ochilish) — (home)/layout.tsx da
  const [session, mode, sp] = await Promise.all([getSession(), getMode(), searchParams]);
  return (
    <Shell footer={<SiteFooter />}>
      <Home session={session} mode={mode} tab={parseLatestTab(sp.ish)} />
    </Shell>
  );
}
