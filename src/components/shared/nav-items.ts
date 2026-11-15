import {
  Bookmark,
  BriefcaseBusiness,
  Building2,
  FileCheck2,
  Inbox,
  LayoutDashboard,
  LifeBuoy,
  MapPinned,
  MessageCircle,
  Search,
  Settings,
  Sparkles,
  User,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import type { NewFeature } from "@/config/new-features";

/**
 * Kabinet bo'limlari — bitta manba (2026-11-15): kompyuterdagi chap yon menyu (SideNav) va telefondagi bosh sahifa menyusi
 * (HomeMenu) shu ro'yxatdan chiziladi. Mijoz va server komponentlari ikkalasi ham import qiladi ("use client" emas).
 * `hintKey` — telefon menyusida nom ostidagi kichik izoh: nima qilishini oddiy so'z bilan ("… ko'rish", "… ochish").
 */
export type MenuMode = "worker" | "employer" | null;
export type BadgeKey = "messages" | "applications" | "offers" | "notifications";

export interface MenuItem {
  key: string;
  href: string;
  labelKey: string;
  hintKey: string;
  icon: LucideIcon;
  badgeKey?: BadgeKey;
  match: (path: string) => boolean;
  /** muhim yangi bo'lim — yozuvsiz yonib-o'chuvchi nuqta (muddati config/new-features.ts da) */
  fresh?: NewFeature;
  /** alohida rangda ajraladi: "Barchasi siz uchun" — to'q sariq, "Universal ustalar" — turkuaz */
  tone?: "ai" | "masters";
}

/** "Barchasi siz uchun" (avval "AI yordamchi"; ega, 2026-11-15: "ko'pchilik AI nimaligini bilmaydi — tushunarli so'z bilan") */
export const isAiPath = (p: string) => p === "/ai";
export const AI_ITEM: MenuItem = {
  key: "ai",
  href: "/ai",
  labelKey: "easy.aiws.nav.ai",
  hintKey: "easy.side.hint.ai",
  icon: Sparkles,
  match: isAiPath,
  fresh: "ai",
  tone: "ai",
};

export const MASTERS_ITEM: MenuItem = {
  key: "masters",
  href: "/ustalar",
  labelKey: "masters.name",
  hintKey: "easy.side.hint.masters",
  icon: Wrench,
  match: (p) => p.startsWith("/ustalar"),
  fresh: "masters",
  tone: "masters",
};

const messages: MenuItem = {
  key: "messages",
  href: "/messages",
  labelKey: "easy.side.messages",
  hintKey: "easy.side.hint.messages",
  icon: MessageCircle,
  badgeKey: "messages",
  match: (p) => p.startsWith("/messages"),
};

export const MORE_ITEMS: MenuItem[] = [
  { key: "settings", href: "/settings", labelKey: "easy.side.settings", hintKey: "easy.side.hint.settings", icon: Settings, match: (p) => p.startsWith("/settings") },
  { key: "help", href: "/help", labelKey: "easy.side.help", hintKey: "easy.side.hint.help", icon: LifeBuoy, match: (p) => p.startsWith("/help") },
];

export const HOME_ITEM = (mode: MenuMode): MenuItem => ({
  key: "home",
  href: "/",
  labelKey: "easy.side.home",
  hintKey: "easy.side.hint.home",
  icon: LayoutDashboard,
  match: (p) => p === "/" || (mode === "employer" && p === "/employer"),
});

/** Asosiy bo'limlar ("Bosh sahifa" va "Universal ustalar"siz — ular joyiga qarab qo'shiladi) */
export function mainItems(mode: MenuMode): MenuItem[] {
  if (mode === "employer") {
    return [
      { ...AI_ITEM, hintKey: "easy.side.hint.ai_employer" },
      { key: "my_vacancies", href: "/employer/vacancies", labelKey: "easy.side.my_vacancies", hintKey: "easy.side.hint.my_vacancies", icon: BriefcaseBusiness, match: (p) => p.startsWith("/employer/vacancies") || p.startsWith("/post/vacancy") },
      { key: "applications", href: "/employer/applications", labelKey: "easy.side.applications", hintKey: "easy.side.hint.emp_applications", icon: Inbox, badgeKey: "applications", match: (p) => p.startsWith("/employer/applications") },
      {
        key: "candidates",
        href: "/search?mode=workers",
        labelKey: "easy.side.candidates",
        hintKey: "easy.side.hint.candidates",
        icon: Users,
        match: (p) => p.startsWith("/search") || p.startsWith("/workers") || p.startsWith("/listing") || p.startsWith("/employer/saved") || p.startsWith("/employer/candidates"),
      },
      messages,
      { key: "company", href: "/company/settings", labelKey: "easy.side.company", hintKey: "easy.side.hint.company", icon: Building2, match: (p) => p.startsWith("/company") },
      { key: "profile", href: "/cabinet", labelKey: "easy.side.profile", hintKey: "easy.side.hint.profile", icon: User, match: (p) => p.startsWith("/cabinet") || p.startsWith("/profile") || p.startsWith("/billing") || p.startsWith("/ai-alerts") || p.startsWith("/offers") },
    ];
  }
  return [
    AI_ITEM,
    {
      key: "jobs",
      href: "/jobs",
      labelKey: "easy.side.vacancies",
      hintKey: "easy.side.hint.jobs",
      icon: Search,
      match: (p) => (p.startsWith("/jobs") && !p.startsWith("/jobs/xarita")) || p.startsWith("/search") || p.startsWith("/listing") || p.startsWith("/students") || p.startsWith("/ai-alerts") || p.startsWith("/cabinet/matches"),
    },
    // yaqin atrofdagi ishlar — Yandex xaritasida
    { key: "map", href: "/jobs/xarita", labelKey: "easy.side.map", hintKey: "easy.side.hint.map", icon: MapPinned, match: (p) => p.startsWith("/jobs/xarita"), fresh: "map" },
    { key: "applications", href: "/applications", labelKey: "easy.side.my_applications", hintKey: "easy.side.hint.my_applications", icon: FileCheck2, badgeKey: "offers", match: (p) => p.startsWith("/applications") || p.startsWith("/offers") },
    { key: "saved", href: "/saved", labelKey: "easy.side.saved", hintKey: "easy.side.hint.saved", icon: Bookmark, match: (p) => p.startsWith("/saved") },
    messages,
    {
      key: "profile",
      href: "/cabinet",
      labelKey: "easy.side.profile",
      hintKey: "easy.side.hint.profile",
      icon: User,
      match: (p) => (p.startsWith("/cabinet") && !p.startsWith("/cabinet/matches")) || p.startsWith("/profile") || p.startsWith("/billing") || p.startsWith("/post"),
    },
  ];
}
