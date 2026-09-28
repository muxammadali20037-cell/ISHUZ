"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Search, Heart, User, Users, ClipboardList, type LucideIcon } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import { useTelegram } from "@/lib/telegram/provider";

export type NavRole = "worker" | "employer" | "guest";

interface NavItem {
  href: string;
  labelKey: string;
  icon: LucideIcon;
  badgeKey?: "messages" | "applications" | "offers" | "notifications";
  match?: (path: string) => boolean;
}

const WORKER_NAV: NavItem[] = [
  { href: "/", labelKey: "common.nav.home", icon: Home, match: (p) => p === "/" },
  { href: "/jobs", labelKey: "common.nav.jobs", icon: Search, match: (p) => p.startsWith("/jobs") },
  { href: "/saved", labelKey: "common.nav.saved", icon: Heart, match: (p) => p.startsWith("/saved") },
  {
    href: "/profile",
    labelKey: "common.nav.profile",
    icon: User,
    badgeKey: "offers",
    match: (p) => p.startsWith("/profile") || p.startsWith("/settings") || p.startsWith("/notifications") || p.startsWith("/applications") || p.startsWith("/offers"),
  },
];

const EMPLOYER_NAV: NavItem[] = [
  { href: "/employer", labelKey: "common.nav.home", icon: Home, match: (p) => p === "/employer" },
  { href: "/workers", labelKey: "common.nav.candidates", icon: Users, match: (p) => p.startsWith("/workers") || p.startsWith("/employer/candidates") },
  { href: "/employer/vacancies", labelKey: "common.nav.vacancies", icon: ClipboardList, match: (p) => p.startsWith("/employer/vacancies") },
  {
    href: "/profile",
    labelKey: "common.nav.profile",
    icon: User,
    match: (p) => p.startsWith("/profile") || p.startsWith("/settings") || p.startsWith("/company") || p.startsWith("/employer/saved") || p.startsWith("/notifications"),
  },
];

const GUEST_NAV: NavItem[] = [
  { href: "/", labelKey: "common.nav.home", icon: Home, match: (p) => p === "/" },
  { href: "/jobs", labelKey: "common.nav.jobs", icon: Search, match: (p) => p.startsWith("/jobs") },
  { href: "/auth", labelKey: "common.nav.login", icon: User, match: (p) => p.startsWith("/auth") },
];

export function BottomNav({ role, counts }: { role: NavRole; counts?: Partial<Record<NonNullable<NavItem["badgeKey"]>, number>> }) {
  const pathname = usePathname();
  const { t } = useT();
  const { haptic } = useTelegram();
  const items = role === "worker" ? WORKER_NAV : role === "employer" ? EMPLOYER_NAV : GUEST_NAV;
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/85 md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      aria-label="Main"
    >
      <ul className="flex h-[var(--tabbar-height)] items-stretch">
        {items.map((item) => {
          const active = item.match ? item.match(pathname) : pathname === item.href;
          const badge = item.badgeKey ? counts?.[item.badgeKey] : undefined;
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                onClick={() => haptic("light")}
                className={cn("relative flex h-full flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors", active ? "text-primary" : "text-muted-foreground hover:text-foreground")}
                aria-current={active ? "page" : undefined}
              >
                <item.icon className={cn("size-6", active && "fill-primary/10")} strokeWidth={active ? 2.25 : 1.75} />
                <span>{t(item.labelKey)}</span>
                {badge ? (
                  <span className="absolute left-1/2 top-2 ml-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white">
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
export function DesktopNavLinks({ role, counts }: { role: NavRole; counts?: Partial<Record<NonNullable<NavItem["badgeKey"]>, number>> }) {
  const pathname = usePathname();
  const { t } = useT();
  const items = role === "worker" ? WORKER_NAV : role === "employer" ? EMPLOYER_NAV : GUEST_NAV;
  return (
    <ul className="hidden items-center gap-1 md:flex">
      {items.map((item) => {
        const active = item.match ? item.match(pathname) : pathname === item.href;
        const badge = item.badgeKey ? counts?.[item.badgeKey] : undefined;
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              className={cn("relative flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium transition-colors", active ? "bg-primary-soft text-primary" : "text-muted-foreground hover:bg-secondary hover:text-foreground")}
            >
              <item.icon className="size-4.5" />
              {t(item.labelKey)}
              {badge ? <span className="ml-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[11px] font-bold text-white">{badge > 99 ? "99+" : badge}</span> : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
