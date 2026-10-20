import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import { getServerEnv } from "@/lib/env";
import { billingEnabled } from "@/lib/features";
import { BrandMark } from "@/components/shared/brand-mark";
import { LanguageSelect } from "@/components/shared/language-switcher";
import { BRAND } from "@/config/brand";
import { EMPTY_FIND, findHref } from "@/features/find/params";
import { seekerQuickFilters } from "../quick-filters";

interface FooterLink {
  href: string;
  label: string;
  external?: boolean;
}

/**
 * Bosh sahifa pastki qismi (to'q ko'k). Faqat haqiqiy sahifa va oqimlarga havolalar: narxlar — to'lovlar yoqilgan bo'lsa,
 * aloqa — SUPPORT_EMAIL sozlangan bo'lsa, Telegram — rasmiy bot sozlangan bo'lsa (soxta ijtimoiy tarmoq havolalari yo'q).
 */
export async function SiteFooter() {
  const { t } = await getT();
  const { SUPPORT_EMAIL, TELEGRAM_BOT_USERNAME } = getServerEnv();
  const bot = TELEGRAM_BOT_USERNAME?.replace(/^@/, "") || null;
  const seek = Object.fromEntries(seekerQuickFilters({ region: null, district: null }).map((f) => [f.key, f.href])) as Record<"salary" | "noexp" | "daily" | "remote", string>;
  const columns: { title: string; links: FooterLink[] }[] = [
    {
      title: t("welcome.market.footer_seekers"),
      links: [
        { href: "/jobs", label: t("welcome.market.f_jobs") },
        { href: seek.daily, label: t("welcome.market.f_daily") },
        { href: seek.remote, label: t("welcome.market.f_remote") },
        { href: findHref(EMPTY_FIND, { mode: "jobs" }), label: t("welcome.market.f_professions") },
      ],
    },
    {
      title: t("welcome.market.footer_employers"),
      links: [
        { href: "/post/vacancy", label: t("welcome.market.f_post") },
        { href: findHref(EMPTY_FIND, { mode: "workers", any: true, region: "all" }), label: t("welcome.market.f_workers") },
        { href: "/help", label: t("welcome.market.f_guide") },
        ...(billingEnabled() ? [{ href: "/pricing", label: t("welcome.market.f_pricing") }] : []),
      ],
    },
    {
      title: t("welcome.market.footer_company"),
      links: [
        { href: "/about", label: t("common.site.nav_about") },
        ...(SUPPORT_EMAIL ? [{ href: `mailto:${SUPPORT_EMAIL}`, label: t("welcome.market.f_contact"), external: true }] : []),
        { href: "/help", label: t("common.footer.support") },
        { href: "/terms", label: t("common.footer.terms") },
        { href: "/privacy", label: t("common.footer.privacy") },
        { href: "/account-deletion", label: t("common.footer.deletion") },
      ],
    },
  ];
  const linkCls = "inline-flex min-h-11 items-center text-base text-navy-muted hover:text-navy-foreground hover:underline";
  return (
    <footer className="page-with-tabbar mt-8 bg-navy text-navy-foreground md:pb-0">
      <div className="container-app grid grid-cols-1 gap-8 py-10 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.3fr)_repeat(3,minmax(0,1fr))] lg:py-14">
        <div>
          <Link href="/" className="inline-flex min-h-11 items-center gap-2 text-xl font-extrabold tracking-tight" aria-label={BRAND.name}>
            <BrandMark className="size-11 rounded-xl" />
            <span>{BRAND.name}</span>
          </Link>
          <p className="mt-2 text-base font-semibold">{t("common.site.tagline")}</p>
          <p className="mt-1 max-w-xs text-sm leading-relaxed text-navy-muted">{t("welcome.market.footer_about")}</p>
          <div className="mt-4">
            <p className="mb-1.5 text-sm font-bold">{t("welcome.market.footer_language")}</p>
            {/* tanlagich oq sirtda — matni oddiy (to'q) rangda */}
            <LanguageSelect className="text-foreground" />
          </div>
          {bot ? (
            <a href={`https://t.me/${bot}`} target="_blank" rel="noopener noreferrer" className={`${linkCls} mt-2`}>
              {t("welcome.market.f_telegram")} · @{bot}
            </a>
          ) : null}
        </div>
        {columns.map((c) => (
          <nav key={c.title} aria-label={c.title}>
            <p className="text-sm font-extrabold uppercase tracking-wide">{c.title}</p>
            <ul className="mt-2">
              {c.links.map((l) => (
                <li key={`${c.title}:${l.label}`}>
                  {l.external ? (
                    <a href={l.href} className={linkCls}>
                      {l.label}
                    </a>
                  ) : (
                    <Link href={l.href} prefetch={false} className={linkCls}>
                      {l.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-navy-line">
        <p className="container-app py-5 text-sm text-navy-muted">{t("common.footer.rights", { year: new Date().getFullYear() })}</p>
      </div>
    </footer>
  );
}
