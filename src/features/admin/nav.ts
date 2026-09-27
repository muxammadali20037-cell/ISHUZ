import type { Permission } from "./permissions";
import type { SidebarCounts } from "./queries/dashboard";

export type NavIcon =
  | "dashboard"
  | "analytics"
  | "users"
  | "workers"
  | "employers"
  | "verifications"
  | "vacancies"
  | "reports"
  | "reviews"
  | "categories"
  | "skills"
  | "regions"
  | "notifications"
  | "audit"
  | "settings"
  | "payments";

export interface NavItem {
  href: string;
  /** admin.nav.<key> */
  key: string;
  icon: NavIcon;
  /** Ko'rinishi uchun kerak ruxsat (yo'q bo'lsa hamma admin ko'radi) */
  perm?: Permission;
  badge?: keyof SidebarCounts;
  exact?: boolean;
}

export interface NavGroup {
  /** admin.nav_groups.<key> */
  key: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    key: "overview",
    items: [
      { href: "/admin", key: "dashboard", icon: "dashboard", exact: true },
      { href: "/admin/analytics", key: "analytics", icon: "analytics", perm: "analytics.view" },
    ],
  },
  {
    key: "people",
    items: [
      { href: "/admin/users", key: "users", icon: "users", perm: "users.view" },
      { href: "/admin/workers", key: "workers", icon: "workers", perm: "workers.view" },
      { href: "/admin/employers", key: "employers", icon: "employers", perm: "employers.view" },
      { href: "/admin/verifications", key: "verifications", icon: "verifications", perm: "employers.verify", badge: "verifications" },
    ],
  },
  {
    key: "content",
    items: [
      { href: "/admin/vacancies", key: "vacancies", icon: "vacancies", perm: "vacancies.view", badge: "vacancies" },
      { href: "/admin/reports", key: "reports", icon: "reports", perm: "reports.view", badge: "reports" },
      { href: "/admin/reviews", key: "reviews", icon: "reviews", badge: "reviews" },
    ],
  },
  {
    key: "reference",
    items: [
      { href: "/admin/categories", key: "categories", icon: "categories", perm: "categories.manage" },
      { href: "/admin/skills", key: "skills", icon: "skills", perm: "skills.manage" },
      { href: "/admin/regions", key: "regions", icon: "regions", perm: "regions.manage" },
    ],
  },
  {
    key: "system",
    items: [
      { href: "/admin/notifications", key: "notifications", icon: "notifications", perm: "notifications.broadcast" },
      { href: "/admin/payments", key: "payments", icon: "payments", perm: "settings.manage" },
      { href: "/admin/audit", key: "audit", icon: "audit", perm: "audit.view" },
      { href: "/admin/settings", key: "settings", icon: "settings" },
    ],
  },
];
