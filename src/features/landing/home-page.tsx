import { getT } from "@/lib/i18n/server";
import { getServerEnv, publicEnv } from "@/lib/env";
import type { SessionContext } from "@/features/auth/session";
import type { AppMode } from "@/features/mode/mode";
import { ModeSwitch } from "@/features/mode/components/mode-switch";
import { BRAND } from "@/config/brand";
import { SeekerHome } from "./seeker-home";
import { EmployerHome } from "./employer-home";
import { MarketHome } from "./market/market-home";

/**
 * Bosh sahifa. Rejim tanlanmagan (mehmon yoki yangi foydalanuvchi) — marketplace ko'rinishi (market/market-home): sarlavha,
 * "Ish qidiraman" / "Xodim qidiraman", qidiruv paneli, sohalar, yangi ishlar, ish beruvchilar bo'limi (birinchi ochilishdagi
 * til va tanishtiruv — /start, app/page.tsx). Rejim tanlangan — o'sha rolning bosh sahifasi. Almashtirgich faqat mehmonda
 * (tasdiq bilan): kirgan foydalanuvchi rolini kirishda tanlaydi, keyin — Kabinetim → "Rolni o'zgartirish".
 * Pastki qism (footer) — hammasida bir xil, <main> dan tashqarida (app/page.tsx → Shell).
 */
export async function HomePage({ session, mode }: { session: SessionContext | null; mode: AppMode | null }) {
  const { t } = await getT();
  const base = publicEnv.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  // rasmiy ijtimoiy tarmoqlar (footer bilan bir xil manba: SOCIAL_*_URL) — qidiruv tizimlari brendni ular bilan bog'laydi
  const { SOCIAL_TELEGRAM_URL, SOCIAL_INSTAGRAM_URL, SOCIAL_FACEBOOK_URL } = getServerEnv();
  const sameAs = [SOCIAL_TELEGRAM_URL, SOCIAL_INSTAGRAM_URL, SOCIAL_FACEBOOK_URL].filter((x): x is string => !!x);
  const jsonLd = JSON.stringify([
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: BRAND.name,
      url: base,
      logo: `${base}/icons/icon-512.png`,
      description: t("common.meta.org_description"),
      ...(sameAs.length ? { sameAs } : {}),
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: BRAND.name,
      url: base,
      inLanguage: ["uz", "ru"],
      potentialAction: { "@type": "SearchAction", target: { "@type": "EntryPoint", urlTemplate: `${base}/search?q={search_term_string}` }, "query-input": "required name=search_term_string" },
    },
  ]).replace(/</g, "\\u003c");

  if (!mode) {
    return (
      <>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
        <MarketHome />
      </>
    );
  }

  return (
    <>
      <div className="container-app py-4 sm:py-6">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
        {session ? null : <ModeSwitch mode={mode} className="mb-5 sm:mx-0 sm:max-w-sm" />}
        {mode === "employer" ? <EmployerHome session={session} flush={!!session} /> : <SeekerHome session={session} flush={!!session} />}
      </div>
    </>
  );
}
