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

type Key = "home" | "jobs" | "workers" | "services" | "about";

function items(pricing: boolean): { key: Key; href: string }[] {
  return [
    { key: "home", href: "/" },
    { key: "jobs", href: "/search?mode=jobs" },
    { key: "workers", href: "/search?mode=workers" },
    ...(pricing ? [{ key: "services" as const, href: "/pricing" }] : []),
    { key: "about", href: "/about" },
  ];
}

function activeKey(pathname: string, mode: string | null): Key | null {
  if (pathname === "/") return "home";
  if (pathname.startsWith("/workers") || pathname.startsWith("/listing") || (pathname.startsWith("/search") && mode === "workers")) return "workers";
  if (pathname.startsWith("/search") || pathname.startsWith("/jobs") || pathname.startsWith("/students")) return "jobs";
  if (pathname.startsWith("/pricing")) return "services";
  if (pathname.startsWith("/about")) return "about";
  return null;
}

const LABEL: Record<Key, string> = {
  home: "common.site.nav_home",
  jobs: "common.site.nav_jobs",
  workers: "common.site.nav_workers",
  services: "common.site.nav_services",
  about: "common.site.nav_about",
};

function DesktopLinks({ pricing, mode }: { pricing: boolean; mode: string | null }) {
  const { t } = useT();
  const pathname = usePathname();
  const active = activeKey(pathname, mode);
  return (
    <ul className="flex items-center gap-1">
      {items(pricing).map((it) => (
        <li key={it.key}>
          <Link
            href={it.href}
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

function ModeAware({ pricing }: { pricing: boolean }) {
  const mode = useSearchParams().get("mode");
  return <DesktopLinks pricing={pricing} mode={mode} />;
}

/** Kompyuter va planshet (md+): sayt bo'limlari. Faol bo'lim belgilanadi ("Ishchilar" — /search?mode=workers ham) */
export function SiteNavLinks({ pricing }: { pricing: boolean }) {
  const { t } = useT();
  return (
    <nav aria-label={t("common.site.nav_label")} className="hidden md:block">
      {/* useSearchParams statik sahifalarda Suspense talab qiladi; kutish paytida — rejimsiz holat */}
      <Suspense fallback={<DesktopLinks pricing={pricing} mode={null} />}>
        <ModeAware pricing={pricing} />
      </Suspense>
    </nav>
  );
}

/** Telefonda (md dan tor): sayt bo'limlari menyusi. Pastki menyu (ilova bo'limlari) o'z joyida qoladi */
export function SiteMenu({ pricing, registerHref }: SiteNavConfig) {
  const { t } = useT();
  // "Bosh sahifa" va "Ishlar" — pastki menyuda bor; bu yerda faqat qolgan bo'limlar
  const extra = items(pricing).filter((it) => it.key !== "home" && it.key !== "jobs");
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
          <Link href="/help">{t("common.site.nav_help")}</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="min-h-11 text-base font-bold text-primary focus:text-primary">
          <Link href={registerHref}>{t("common.site.register")}</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
