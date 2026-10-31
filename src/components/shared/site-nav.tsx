"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Menu } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

/** Mehmon (rejim tanlanmagan) uchun sayt bo'limlari; "Xizmatlar" — faqat to'lovlar yoqilgan bo'lsa (/pricing) */
export interface SiteNavConfig {
  pricing: boolean;
  /** "Ro'yxatdan o'tish": rol → telefon → profil (mavjud kirish oqimi) */
  registerHref: string;
}

/**
 * Sayt menyusi (2026-10-31 auditi, egasining spetsifikatsiyasi): Ish qidirish · Kompaniyalar · Kasblar · Ish beruvchilar uchun.
 * "Bosh sahifa" — logotip; "Biz haqimizda", "Yordam", narxlar — footer va telefon menyusida. "Ish qidirish" — to'liq filtrli
 * ro'yxat (/jobs), "Kasblar" — soha → kasb → hudud bo'yicha bosqichli tanlash (/search?mode=jobs).
 */
type Key = "jobs" | "companies" | "professions" | "employers";

function items(): { key: Key; href: string }[] {
  return [
    { key: "jobs", href: "/jobs" },
    { key: "companies", href: "/companies" },
    { key: "professions", href: "/search?mode=jobs" },
    { key: "employers", href: "/for-employers" },
  ];
}

function activeKey(pathname: string, mode: string | null): Key | null {
  if (pathname.startsWith("/jobs") || pathname.startsWith("/students")) return "jobs";
  if (pathname.startsWith("/companies") || pathname.startsWith("/company/")) return "companies";
  if (pathname.startsWith("/search") && mode !== "workers") return "professions";
  if (pathname.startsWith("/for-employers") || pathname.startsWith("/workers") || pathname.startsWith("/listing") || (pathname.startsWith("/search") && mode === "workers"))
    return "employers";
  return null;
}

const LABEL: Record<Key, string> = {
  jobs: "common.site.nav_find_jobs",
  companies: "common.site.nav_companies",
  professions: "common.site.nav_professions",
  employers: "common.site.nav_for_employers",
};

function DesktopLinks({ mode }: { mode: string | null }) {
  const { t } = useT();
  const pathname = usePathname();
  const active = activeKey(pathname, mode);
  return (
    <ul className="flex items-center gap-1">
      {items().map((it) => (
        <li key={it.key}>
          <Link
            href={it.href}
            data-track="site_nav"
            data-track-to={it.key}
            aria-current={active === it.key ? "page" : undefined}
            className={cn(
              "flex min-h-11 items-center whitespace-nowrap rounded-xl px-3 text-base font-semibold transition-colors lg:px-3.5",
              active === it.key ? "bg-primary-soft text-primary" : "text-muted-foreground hover:bg-secondary hover:text-foreground",
            )}
          >
            {t(LABEL[it.key])}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function ModeAware() {
  const mode = useSearchParams().get("mode");
  return <DesktopLinks mode={mode} />;
}

/** Kompyuter va planshet (md+): sayt bo'limlari. Faol bo'lim belgilanadi */
export function SiteNavLinks() {
  const { t } = useT();
  return (
    <nav aria-label={t("common.site.nav_label")} className="hidden md:block">
      {/* useSearchParams statik sahifalarda Suspense talab qiladi; kutish paytida — rejimsiz holat */}
      <Suspense fallback={<DesktopLinks mode={null} />}>
        <ModeAware />
      </Suspense>
    </nav>
  );
}

/** Telefonda (md dan tor): sayt bo'limlari menyusi. Pastki menyu (ilova bo'limlari) o'z joyida qoladi */
export function SiteMenu({ pricing, registerHref }: SiteNavConfig) {
  const { t } = useT();
  // "Ish qidirish" — pastki menyuda bor; bu yerda qolgan bo'limlar + biz haqimizda, narxlar (yoqilgan bo'lsa), yordam
  const extra = items().filter((it) => it.key !== "jobs");
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden" aria-label={t("common.site.menu")}>
          <Menu className="size-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[13rem]">
        {extra.map((it) => (
          <DropdownMenuItem key={it.key} asChild className="min-h-11 text-base font-semibold">
            <Link href={it.href}>{t(LABEL[it.key])}</Link>
          </DropdownMenuItem>
        ))}
        <DropdownMenuItem asChild className="min-h-11 text-base font-semibold">
          <Link href="/about">{t("common.site.nav_about")}</Link>
        </DropdownMenuItem>
        {pricing ? (
          <DropdownMenuItem asChild className="min-h-11 text-base font-semibold">
            <Link href="/pricing">{t("common.site.nav_services")}</Link>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem asChild className="min-h-11 text-base font-semibold">
          <Link href="/help">{t("common.site.nav_help")}</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="min-h-11 text-base font-bold text-primary focus:text-primary">
          <Link href="/post/vacancy" data-track="home_post_vacancy" data-track-to="site_menu">
            {t("common.site.post_job")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="min-h-11 text-base font-semibold">
          <Link href={registerHref}>{t("common.site.register")}</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
