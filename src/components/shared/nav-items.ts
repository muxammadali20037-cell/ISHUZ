import {
  Bookmark,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  ClipboardList,
  FileCheck2,
  Inbox,
  LayoutDashboard,
  LifeBuoy,
  MapPinned,
  MessageCircle,
  MessageSquareText,
  Plus,
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
  /** `find` — /search sahifasidagi ?mode= (ish yoki ishchi): "Ishlar" va "Ishchilar" bo'limlari shu bilan ajraladi */
  match: (path: string, find?: string | null) => boolean;
  /** muhim yangi bo'lim — yozuvsiz yonib-o'chuvchi nuqta (muddati config/new-features.ts da) */
  fresh?: NewFeature;
  /** alohida rangda ajraladi: "Yordamchi" — to'q sariq, "Universal ustalar" — turkuaz, "E'lon joylash" — gradient */
  tone?: "ai" | "masters" | "post";
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

/** "E'lon joylash" (ega, 2026-11-17: bosh ekran bo'limlari ro'yxatida eng tepada) — ish izlovchi: o'zi haqida e'lon, ish beruvchi: vakansiya */
export const POST_ITEM = (mode: MenuMode): MenuItem => ({
  key: "post",
  // ish izlovchi — yordamchi bilan e'lon (ega, 2026-11-17: "bossa AI yordamchiga olib kirsin")
  href: mode === "employer" ? "/post/vacancy" : "/ai/post",
  labelKey: "easy.side.menu.post",
  hintKey: mode === "employer" ? "easy.side.menu.post_hint_employer" : "easy.side.menu.post_hint_worker",
  icon: Plus,
  match: (p) => p.startsWith("/post") || p.startsWith("/ai/post"),
  tone: "post",
});

/** "Kunlik ish" — kunlik haqli ishlar (kasb so'ralmaydi) */
export const DAILY_ITEM: MenuItem = {
  key: "daily",
  href: "/search?mode=jobs&pay=daily",
  labelKey: "easy.side.menu.daily",
  hintKey: "easy.side.menu.daily_hint",
  icon: CalendarDays,
  match: () => false,
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

/*
 * Soddalashtirilgan asosiy menyu (ega, 2026-11-20: "ilova chalkash — pastda faqat 5 ta bo'lim; kirgandan keyin chatga kirsin").
 * Rejimga qarab (ega, 2026-11-20, kechqurun: "ishchi panelida Ishchilar nimaga kerak — o'rniga qiziqarli narsa"):
 *  - ish izlovchi: Sizga mos · Ishlar · [Izlash/E'lon] · E'lonlarim · Profil
 *  - ish beruvchi: Ishchilar · Arizalar · [Izlash/E'lon] · E'lonlarim · Profil
 *  - rejim tanlanmagan (mehmon, robot): Ishchilar · Ishlar · [Izlash/E'lon] · E'lonlarim · Profil
 * Telefonda pastki menyu, kompyuterda yon menyu. O'rtada — "Izlash/E'lon" (/chat).
 */
export const WORKERS_HREF = "/search?mode=workers&any=1&region=all";
export const CHAT_HREF = "/chat";

const onSearch = (p: string) => p === "/search" || p.startsWith("/search/");
export const isWorkersPath = (p: string, find?: string | null) =>
  p.startsWith("/listing") || p.startsWith("/workers") || p.startsWith("/employer/saved") || p.startsWith("/employer/candidates") || (onSearch(p) && find === "workers");
export const isJobsPath = (p: string, find?: string | null) =>
  p.startsWith("/jobs") ||
  p.startsWith("/students") ||
  p.startsWith("/companies") ||
  (p.startsWith("/company/") && !p.startsWith("/company/settings") && !p.startsWith("/company/join")) ||
  p.startsWith("/sohalar") ||
  p.startsWith("/kasblar") ||
  p.startsWith("/ai-alerts") ||
  p.startsWith("/cabinet/matches") ||
  (onSearch(p) && find !== "workers");
export const isChatPath = (p: string) => p.startsWith(CHAT_HREF) || p === "/ai" || p.startsWith("/ai/") || p.startsWith("/post");
export const isMyListingsPath = (p: string) => p.startsWith("/cabinet/elonlar") || p.startsWith("/employer/vacancies") || p.startsWith("/employer/applications");
export const isMatchesPath = (p: string) => p.startsWith("/cabinet/matches");
export const isApplicationsPath = (p: string) => p.startsWith("/employer/applications");
const PROFILE_PREFIXES = ["/cabinet", "/profile", "/settings", "/notifications", "/billing", "/help", "/messages", "/saved", "/applications", "/offers", "/company/settings", "/onboarding"];
export const isProfilePath = (p: string) => p === "/employer" || (PROFILE_PREFIXES.some((x) => p.startsWith(x)) && !isMyListingsPath(p) && !isMatchesPath(p));

export const APP_WORKERS: MenuItem = { key: "workers", href: WORKERS_HREF, labelKey: "easy.nav.tab_workers", hintKey: "easy.side.hint.candidates", icon: Users, match: isWorkersPath };
export const APP_JOBS: MenuItem = { key: "jobs", href: "/jobs", labelKey: "easy.nav.tab_jobs", hintKey: "easy.side.hint.jobs", icon: BriefcaseBusiness, match: isJobsPath };
export const APP_CHAT: MenuItem = { key: "chat", href: CHAT_HREF, labelKey: "easy.nav.tab_chat", hintKey: "easy.start_chat.title", icon: MessageSquareText, match: isChatPath };
export const APP_MY_LISTINGS: MenuItem = {
  key: "my-listings",
  href: "/cabinet/elonlar",
  labelKey: "easy.nav.tab_my_listings",
  hintKey: "easy.cabinet.page_sub",
  icon: ClipboardList,
  badgeKey: "applications",
  match: isMyListingsPath,
};
export const APP_PROFILE: MenuItem = { key: "profile", href: "/cabinet", labelKey: "easy.nav.tab_profile", hintKey: "easy.side.hint.profile", icon: User, badgeKey: "offers", match: isProfilePath };

/** Ish izlovchi: "Sizga mos" — o'z e'loniga mos ishlar (e'lon bo'lmasa — e'lon berishga taklif) */
export const APP_MATCHES: MenuItem = { key: "matches", href: "/cabinet/matches", labelKey: "easy.nav.tab_matches", hintKey: "easy.matches.title", icon: Sparkles, match: isMatchesPath };
/** Ish beruvchi: kelgan arizalar bir joyda (yangilari soni bilan) */
export const APP_APPLICATIONS: MenuItem = {
  key: "applications",
  href: "/employer/applications",
  labelKey: "easy.nav.tab_applications",
  hintKey: "easy.side.hint.emp_applications",
  icon: Inbox,
  badgeKey: "applications",
  match: isApplicationsPath,
};
/** Ish izlovchining "E'lonlarim"ida arizalar soni yo'q (u ish beruvchiga tegishli) */
const MY_LISTINGS_WORKER: MenuItem = { ...APP_MY_LISTINGS, badgeKey: undefined };
/** Ish beruvchida arizalar — alohida bo'lim, "E'lonlarim" faqat vakansiyalar */
const MY_LISTINGS_EMPLOYER: MenuItem = { ...APP_MY_LISTINGS, badgeKey: undefined, match: (p) => isMyListingsPath(p) && !isApplicationsPath(p) };

/** Telefondagi pastki menyu: 2 ta bo'lim · o'rtada chat · 2 ta bo'lim (rejimga qarab) */
export function appTabs(mode: MenuMode): MenuItem[] {
  if (mode === "worker") return [APP_MATCHES, APP_JOBS, APP_CHAT, MY_LISTINGS_WORKER, APP_PROFILE];
  if (mode === "employer") return [APP_WORKERS, APP_APPLICATIONS, APP_CHAT, MY_LISTINGS_EMPLOYER, APP_PROFILE];
  return [APP_WORKERS, APP_JOBS, APP_CHAT, APP_MY_LISTINGS, APP_PROFILE];
}
/** Rejim tanlanmagan holat (eski import'lar uchun) */
export const APP_TABS: MenuItem[] = appTabs(null);

/** Kompyuterdagi yon menyu: chat birinchi, keyin pastki menyudagi bo'limlar, xabarlar — alohida qator (telefonda yuqori panelda) */
export function appSideItems(mode: MenuMode): MenuItem[] {
  const [a, b, , d, profile] = appTabs(mode);
  return [APP_CHAT, b!, a!, d!, { ...messages, match: (p) => p.startsWith("/messages") }, { ...profile!, match: (p) => isProfilePath(p) && !p.startsWith("/messages") }];
}
export const APP_SIDE_ITEMS: MenuItem[] = appSideItems(null);
