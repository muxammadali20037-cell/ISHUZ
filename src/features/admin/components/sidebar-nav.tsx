"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, BarChart3, Users, UserSearch, Building2, BadgeCheck, Briefcase, Flag, Star, FolderTree, Wrench, MapPin, Megaphone, ScrollText, Settings, type LucideIcon,
} from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import type { NavGroup, NavIcon } from "../nav";
import type { SidebarCounts } from "../queries/dashboard";

const ICONS: Record<NavIcon, LucideIcon> = {
  dashboard: LayoutDashboard,
  analytics: BarChart3,
  users: Users,
  workers: UserSearch,
  employers: Building2,
  verifications: BadgeCheck,
  vacancies: Briefcase,
  reports: Flag,
  reviews: Star,
  categories: FolderTree,
  skills: Wrench,
  regions: MapPin,
  notifications: Megaphone,
  audit: ScrollText,
  settings: Settings,
};

/** Yon panel navigatsiyasi (desktop sidebar va mobil Sheet ichida ishlatiladi) */
export function SidebarNav({ groups, counts, onNavigate }: { groups: NavGroup[]; counts: SidebarCounts; onNavigate?: () => void }) {
  const pathname = usePathname();
  const { t } = useT();
  return (
    <nav className="space-y-5" aria-label="Admin">
      {groups.map((g) => (
        <div key={g.key}>
          <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t(`admin.nav_groups.${g.key}`)}</p>
          <ul className="space-y-0.5">
            {g.items.map((item) => {
              const Icon = ICONS[item.icon];
              const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + "/");
              const badge = item.badge ? counts[item.badge] : 0;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex h-10 items-center gap-2.5 rounded-xl px-3 text-sm font-medium transition-colors",
                      active ? "bg-primary-soft text-primary" : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                    )}
                  >
                    <Icon className="size-4.5 shrink-0" strokeWidth={active ? 2.25 : 1.9} />
                    <span className="flex-1 truncate">{t(`admin.nav.${item.key}`)}</span>
                    {badge ? (
                      <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[11px] font-bold text-white tabular">{badge > 99 ? "99+" : badge}</span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
