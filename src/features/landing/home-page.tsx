import Link from "next/link";
import { cookies, headers } from "next/headers";
import { getT } from "@/lib/i18n/server";
import { publicEnv } from "@/lib/env";
import type { SessionContext } from "@/features/auth/session";
import type { AppMode } from "@/features/mode/mode";
import { ModeSwitch } from "@/features/mode/components/mode-switch";
import { BRAND } from "@/config/brand";
import { INTRO_COOKIE, introEligible } from "@/features/intro/intro";
import { IntroOverlay } from "@/features/intro/intro-overlay";
import { SeekerHome } from "./seeker-home";
import { EmployerHome } from "./employer-home";
import { EntryHome } from "./entry-home";
import { getEntryStats } from "./entry-queries";

/**
 * Bosh sahifa. Rejim tanlanmagan (mehmon yoki yangi foydalanuvchi) — kirish oynasi (S1): haqiqiy raqamlar, ikki katta maqsad
 * ("Ish topaman" / "Ishchi topaman"), qidiruv, tez kirish va yangi vakansiyalar; birinchi ochilishda — 3 qadamli tanishtiruv.
 * Rejim tanlangan — o'sha rolning bosh sahifasi; boshqasiga almashtirgich orqali (tasdiq bilan, rollar aralashmaydi).
 */
export async function HomePage({ session, mode }: { session: SessionContext | null; mode: AppMode | null }) {
  const { t } = await getT();
  const base = publicEnv.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  const jsonLd = JSON.stringify([
    { "@context": "https://schema.org", "@type": "Organization", name: BRAND.name, url: base, logo: `${base}/icons/icon-512.png`, description: t("common.meta.org_description") },
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
    const [jar, head] = await Promise.all([cookies(), headers()]);
    const intro = introEligible({ mode, cookie: jar.get(INTRO_COOKIE)?.value, userAgent: head.get("user-agent") });
    const stats = intro ? await getEntryStats() : null;
    return (
      <div className="container-app py-4 sm:py-6">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
        <EntryHome session={session} />
        <HomeFooter />
        {intro ? <IntroOverlay stats={stats ? { vacancies: stats.vacancies, workers: stats.workers } : null} /> : null}
      </div>
    );
  }

  return (
    <div className="container-app py-4 sm:py-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
      <ModeSwitch mode={mode} className="mb-5 sm:mx-0 sm:max-w-sm" />
      {mode === "employer" ? <EmployerHome session={session} /> : <SeekerHome session={session} />}
      <HomeFooter />
    </div>
  );
}

async function HomeFooter() {
  const { t } = await getT();
  const links = [
    { href: "/help", label: t("common.footer.support") },
    { href: "/terms", label: t("common.footer.terms") },
    { href: "/privacy", label: t("common.footer.privacy") },
    { href: "/account-deletion", label: t("common.footer.deletion") },
  ];
  return (
    <footer className="mt-10 border-t border-border pt-6 text-center text-sm text-muted-foreground">
      <div className="mb-2 flex flex-wrap justify-center gap-x-3 font-medium">
        {links.map((l) => (
          <Link key={l.href} href={l.href} prefetch={false} className="inline-flex min-h-11 items-center px-1 text-base text-primary hover:underline">
            {l.label}
          </Link>
        ))}
      </div>
      {t("common.footer.rights", { year: new Date().getFullYear() })}
    </footer>
  );
}
