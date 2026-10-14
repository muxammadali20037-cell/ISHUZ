"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bookmark, Home, Search, User, type LucideIcon } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

export type NavRole = "worker" | "employer" | "guest";
export type NavMode = "worker" | "employer" | null;

interface NavItem {
  href: string;
  labelKey: string;
  icon: LucideIcon;
  badgeKey?: "messages" | "applications" | "offers" | "notifications";
  match?: (path: string) => boolean;
}

/**
 * Sodda navigatsiya: Bosh sahifa · Ish topish / Xodim topish (joriy rejim) · Saqlanganlar · Kabinetim.
 * E'lonlar, arizalar, takliflar va sozlamalar — "Kabinetim" ichida.
 */
function mainNav(mode: NavMode): NavItem[] {
  return [
    { href: "/", labelKey: "common.nav.home", icon: Home, match: (p) => p === "/" },
    {
      href: mode === "worker" ? "/search?mode=jobs" : mode === "employer" ? "/search?mode=workers" : "/search",
      labelKey: mode === "worker" ? "easy.nav.jobs" : mode === "employer" ? "easy.nav.workers" : "easy.nav.search",
      icon: Search,
      match: (p) => p.startsWith("/search") || p.startsWith("/jobs") || p.startsWith("/workers") || p.startsWith("/listing"),
    },
    { href: "/saved", labelKey: "easy.nav.saved", icon: Bookmark, match: (p) => p.startsWith("/saved") },
    {
      href: "/cabinet",
      labelKey: "easy.nav.cabinet",
      icon: User,
      badgeKey: "offers",
      match: (p) =>
        ["/cabinet", "/profile", "/settings", "/notifications", "/applications", "/offers", "/employer", "/company", "/messages", "/post"].some((x) => p.startsWith(x)),
    },
  ];
}

export function BottomNav({ counts, mode = null }: { role: NavRole; mode?: NavMode; counts?: Partial<Record<NonNullable<NavItem["badgeKey"]>, number>> }) {
  const pathname = usePathname();
  const { t } = useT();
  const items = mainNav(mode);
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      aria-label={t("common.nav.main_label")}
    >
      <ul className="flex h-[var(--tabbar-height)] items-stretch">
        {items.map((item) => {
          const active = item.match ? item.match(pathname) : pathname === item.href;
          const badge = item.badgeKey ? counts?.[item.badgeKey] : undefined;
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                className={cn("press relative flex h-full flex-col items-center justify-center gap-1 text-xs font-semibold", active ? "text-primary" : "text-muted-foreground hover:text-foreground")}
                aria-current={active ? "page" : undefined}
              >
                <item.icon className={cn("size-6", active && "fill-primary/10")} strokeWidth={active ? 2.25 : 1.75} />
                <span>{t(item.labelKey)}</span>
                {badge ? (
                  <span className="absolute left-1/2 top-2 ml-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-2xs font-bold text-destructive-foreground">
                    {badge > 99 ? "99+" : badge}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Desktop uchun yon/ustki navigatsiya havolalari */
export function DesktopNavLinks({ counts, mode = null }: { role: NavRole; mode?: NavMode; counts?: Partial<Record<NonNullable<NavItem["badgeKey"]>, number>> }) {
  const pathname = usePathname();
  const { t } = useT();
  const items = mainNav(mode);
  return (
    <nav aria-label={t("common.nav.main_label")} className="hidden md:block">
    <ul className="flex items-center gap-1">
      {items.map((item) => {
        const active = item.match ? item.match(pathname) : pathname === item.href;
        const badge = item.badgeKey ? counts?.[item.badgeKey] : undefined;
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              title={t(item.labelKey)}
              className={cn(
                "relative flex min-h-11 min-w-11 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-3 py-2 text-base font-semibold transition-colors lg:px-4",
                active ? "bg-primary-soft text-primary" : "text-muted-foreground hover:bg-secondary hover:text-foreground",
              )}
            >
              <item.icon className="size-4.5" aria-hidden />
              {/* planshetda (md) faqat belgi — sarlavha ekrandan chiqib ketmasin; nom ekran o'quvchisi uchun saqlanadi */}
              <span className="sr-only lg:not-sr-only">{t(item.labelKey)}</span>
              {badge ? <span className="ml-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-2xs font-bold text-destructive-foreground">{badge > 99 ? "99+" : badge}</span> : null}
            </Link>
          </li>
        );
      })}
    </ul>
    </nav>
  );
}
