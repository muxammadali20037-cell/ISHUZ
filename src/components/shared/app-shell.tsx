"use client";

import { SocialLinks } from "./social-links";
import type { SocialLink } from "@/lib/social";
import { useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Bookmark, BriefcaseBusiness, Building2, FileCheck2, Inbox, LayoutDashboard, LifeBuoy, MessageCircle, Plus, Search, Settings, Sparkles, User, Users, Wrench, type LucideIcon } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import { initials } from "@/lib/format";
import { BRAND } from "@/config/brand";
import { BrandMark } from "@/components/shared/brand-mark";
import { LanguageSelect } from "./language-switcher";
import { UserMenu } from "./user-menu";
import type { TopBarUser } from "./top-bar";

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
 * Rolga xos navigatsiya (2026-10 redizayn):
 *   Ish qidiruvchi (va rejim tanlamagan mehmon): Ishlar · Saqlangan · Arizalar · Profil
 *   Ish beruvchi:                                Boshqaruv · Vakansiyalar · Nomzodlar · Profil
 * Chat va bildirishnomalar — yuqori panelda. AI qidiruv — qidiruv yonida ("AI bilan qidirish"), AI sahifalari "Ishlar" ichida.
 * Takliflar (ish beruvchidan) — "Arizalar" bilan birga. Eski manzillar (/search, /cabinet, /saved, /applications, /employer…) o'zgarmagan.
 */
const PROFILE_PATHS = ["/cabinet", "/profile", "/settings", "/notifications", "/billing", "/help", "/messages"];

/**
 * "AI yordamchi" — alohida bo'lim (2026-11-12, egasi: "AI yordamchi bo'limi qani — bossa ChatGPT kabi ochilsin"): kompyuterda
 * yon menyu va yuqori menyuda "Bosh sahifa"dan keyin; telefonda — yuqori paneldagi belgi (top-bar) va bosh sahifadagi karta
 * (pastki menyuda joy yo'q: 5 ta katak, 320 px da oltinchisi sig'maydi).
 */
const isAiPath = (p: string) => p === "/ai";
const AI_NAV: NavItem = { href: "/ai", labelKey: "easy.aiws.nav.ai", icon: Sparkles, match: isAiPath };

function mainNav(mode: NavMode): NavItem[] {
  if (mode === "employer") {
    return [
      { href: "/", labelKey: "easy.nav.tab_dashboard", icon: LayoutDashboard, match: (p) => p === "/" || p === "/employer" },
      {
        href: "/employer/vacancies",
        labelKey: "easy.nav.tab_vacancies",
        icon: BriefcaseBusiness,
        badgeKey: "applications",
        match: (p) => p.startsWith("/employer/vacancies") || p.startsWith("/employer/applications") || p.startsWith("/post/vacancy"),
      },
      {
        href: "/search?mode=workers",
        labelKey: "easy.nav.tab_candidates",
        icon: Users,
        match: (p) => p.startsWith("/search") || p.startsWith("/workers") || p.startsWith("/listing") || p.startsWith("/employer/saved") || p.startsWith("/employer/candidates"),
      },
      {
        href: "/cabinet",
        labelKey: "easy.nav.tab_profile",
        icon: User,
        match: (p) => PROFILE_PATHS.some((x) => p.startsWith(x)) || p.startsWith("/ai") || p.startsWith("/company") || p.startsWith("/offers"),
      },
    ];
  }
  return [
    {
      href: "/",
      labelKey: "easy.nav.tab_jobs",
      icon: Search,
      match: (p) =>
        p === "/" || p.startsWith("/search") || p.startsWith("/jobs") || p.startsWith("/listing") || p.startsWith("/students") || p === "/ai" || p.startsWith("/ai-alerts") || p.startsWith("/cabinet/matches"),
    },
    { href: "/saved", labelKey: "easy.nav.tab_saved", icon: Bookmark, match: (p) => p.startsWith("/saved") },
    { href: "/applications", labelKey: "easy.nav.tab_applications", icon: FileCheck2, badgeKey: "offers", match: (p) => p.startsWith("/applications") || p.startsWith("/offers") },
    {
      href: "/cabinet",
      labelKey: "easy.nav.tab_profile",
      icon: User,
      match: (p) => (PROFILE_PATHS.some((x) => p.startsWith(x)) && !p.startsWith("/cabinet/matches")) || p.startsWith("/post"),
    },
  ];
}

/** Markaziy "E'lon" tugmasi (OLX/super-ilovalar uslubi): ish qidiruvchi — o'zi haqida e'lon (CV), ish beruvchi — vakansiya */
export function postAction(mode: NavMode): { href: string; labelKey: string; ctaKey: string } {
  return mode === "employer"
    ? { href: "/post/vacancy", labelKey: "easy.nav.tab_post", ctaKey: "easy.start.post_vacancy" }
    : { href: "/post/worker", labelKey: "easy.nav.tab_post", ctaKey: "easy.nav.post_worker_cta" };
}

export function BottomNav({ counts, mode = null }: { role: NavRole; mode?: NavMode; counts?: Partial<Record<NonNullable<NavItem["badgeKey"]>, number>> }) {
  const pathname = usePathname();
  const { t } = useT();
  const items = mainNav(mode);
  const post = postAction(mode);
  const postActive = pathname.startsWith(post.href);
  // o'rtada — "E'lon" (2 ta bo'lim · E'lon · 2 ta bo'lim): ko'k pilyula, menyu ichida (yozuvni to'smaydi). Hamma bo'limda belgi
  // maydoni bir xil balandlikda (h-8) — nomlar bitta chiziqda turadi
  const cells: (NavItem | "post")[] = [...items.slice(0, 2), "post", ...items.slice(2)];
  return (
    <nav
      className="bottom-nav fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card md:hidden"
      style={{ paddingBottom: "var(--safe-bottom)" }}
      aria-label={t("common.nav.main_label")}
    >
      <ul className="flex h-[var(--tabbar-height)] items-stretch">
        {cells.map((item) => {
          if (item === "post") {
            return (
              <li key="post" className="flex flex-1 justify-center">
                <Link
                  href={post.href}
                  aria-current={postActive ? "page" : undefined}
                  data-track="nav_post"
                  className="press flex h-full flex-col items-center justify-center gap-0.5 text-2xs font-medium text-primary-ink"
                >
                  <span className="flex h-8 w-12 items-center justify-center rounded-md bg-primary text-primary-foreground" aria-hidden>
                    <Plus className="size-5" strokeWidth={2.5} />
                  </span>
                  <span>{t(post.labelKey)}</span>
                </Link>
              </li>
            );
          }
          const active = item.match ? item.match(pathname) : pathname === item.href;
          const badge = item.badgeKey ? counts?.[item.badgeKey] : undefined;
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                className={cn("press relative flex h-full flex-col items-center justify-center gap-0.5 text-2xs font-medium", active ? "text-primary-ink" : "text-muted-foreground hover:text-foreground")}
                aria-current={active ? "page" : undefined}
              >
                <span className="flex h-8 items-center" aria-hidden>
                  <item.icon className="size-5" strokeWidth={active ? 2.25 : 1.75} />
                </span>
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
  // "AI yordamchi" — birinchi bo'limdan keyin; /ai ochiq bo'lsa faqat u belgilanadi (telefonda /ai — "Ishlar"/"Profil" ichida)
  const [first, ...rest] = mainNav(mode);
  const items: NavItem[] = first ? [first, AI_NAV, ...rest] : [AI_NAV];
  const onAi = isAiPath(pathname);
  const [navRef, compact] = useFitLabels(items.map((i) => t(i.labelKey)).join("|"));
  return (
    <nav ref={navRef} aria-label={t("common.nav.main_label")} className="hidden md:block">
    <ul className="flex items-center gap-1">
      {items.map((item) => {
        const active = item === AI_NAV ? onAi : !onAi && (item.match ? item.match(pathname) : pathname === item.href);
        const badge = item.badgeKey ? counts?.[item.badgeKey] : undefined;
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              title={t(item.labelKey)}
              {...(item === AI_NAV ? { "data-ai-entry": true, "data-track": "ai_entry", "data-track-to": "top" } : {})}
              className={cn(
                "relative flex min-h-11 min-w-11 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-3 py-2 text-base font-semibold transition-colors",
                active ? "bg-primary-soft text-primary-ink" : "text-muted-foreground hover:bg-secondary hover:text-foreground",
              )}
            >
              <item.icon className="size-4.5" aria-hidden />
              {/* planshetda (md) va joy yetmaganda (uzun nomlar, o'ng tomonda "Vakansiya joylash") — faqat belgi: menyu o'ngdagi
                  tugmalar ostiga kirib, ularni to'smaydi; nom ekran o'quvchisi va title uchun saqlanadi */}
              {/* "AI yordamchi" nomi kompyuterda doim ko'rinadi (joy yetmasa ham): yangi bo'lim faqat belgi bo'lib qolmasin */}
              <span className={compact && item !== AI_NAV ? "sr-only" : "sr-only lg:not-sr-only"}>{t(item.labelKey)}</span>
              {badge ? <span className="ml-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-2xs font-bold text-destructive-foreground">{badge > 99 ? "99+" : badge}</span> : null}
            </Link>
          </li>
        );
      })}
      {/* "Universal ustalar" (turkuaz) — planshetda belgi bilan; kompyuterda nomli bo'limlar sig'ishi uchun bu yerda yo'q:
          kirgan foydalanuvchida yon menyuda, mehmonda — bosh sahifadagi kartada */}
      <li className="lg:hidden">
        <Link
          href="/ustalar"
          data-track="masters_entry"
          data-masters-entry
          title={t("masters.name")}
          className="theme-masters flex size-11 items-center justify-center rounded-xl bg-primary-soft text-primary-ink ring-1 ring-primary/30 transition-colors hover:ring-primary/60"
        >
          <Wrench className="size-4.5" aria-hidden />
          <span className="sr-only">{t("masters.name")}</span>
        </Link>
      </li>
    </ul>
    </nav>
  );
}

/**
 * Yuqori menyu nomlari joyiga sig'adimi (kompyuter, lg+): sig'masa — faqat belgilar. Menyu joyi (`flex-1 min-w-0`) qolgan
 * kenglikka teng, mazmunga bog'liq emas — shuning uchun nomlar bilan to'liq kenglik bir marta o'lchanadi va joy bilan
 * solishtiriladi (til, rejim yoki shrift o'zgarsa — qayta). Holat ref'da ham saqlanadi: ResizeObserver eski qiymatni ko'rmaydi.
 */
function useFitLabels(labelsKey: string) {
  const ref = useRef<HTMLElement>(null);
  const [on, setOn] = useState(false);
  const state = useRef({ on: false, full: 0 });
  useLayoutEffect(() => {
    const nav = ref.current;
    const slot = nav?.parentElement;
    if (!nav || !slot) return;
    state.current = { on: false, full: 0 };
    setOn(false);
    const wide = window.matchMedia("(min-width: 64rem)");
    const check = () => {
      if (!wide.matches) return; // planshetda nomlar baribir yashirin
      const ul = nav.firstElementChild as HTMLElement | null;
      if (!ul) return;
      const room = slot.clientWidth;
      const s = state.current;
      if (!s.on) {
        s.full = ul.scrollWidth;
        if (s.full > room + 1) {
          s.on = true;
          setOn(true);
        }
      } else if (s.full > 0 && s.full <= room) {
        s.on = false;
        setOn(false);
      }
    };
    check();
    const ro = new ResizeObserver(check);
    ro.observe(slot);
    wide.addEventListener("change", check);
    return () => {
      ro.disconnect();
      wide.removeEventListener("change", check);
    };
  }, [labelsKey]);
  return [ref, on] as const;
}

/**
 * Kompyuter (lg+) uchun chap yon menyu — kirgan foydalanuvchi (2026-11 redizayn, "Hirelly" uslubi): to'q ko'k panel, faol bo'lim —
 * ko'k plita. Ish qidiruvchi: Bosh sahifa · Vakansiyalar · Arizalarim · Saqlanganlar · Xabarlar · Profil; ish beruvchi:
 * Bosh sahifa · Vakansiyalarim · Arizalar · Nomzodlar · Xabarlar · Kompaniya · Profil; pastda — Bildirishnomalar, Sozlamalar, Yordam
 * (asosiy amal — yuqori paneldagi tugma). Telefon va planshetda — avvalgidek pastki va yuqori menyu.
 * Hisoblagichlar — haqiqiy o'qilmaganlar (yuqori paneldagi bilan bir xil).
 */
interface SideItem {
  href: string;
  labelKey: string;
  icon: LucideIcon;
  badgeKey?: "messages" | "applications" | "offers" | "notifications";
  match: (path: string) => boolean;
}

function sideNav(mode: NavMode): { main: SideItem[]; more: SideItem[] } {
  const more: SideItem[] = [
    { href: "/settings", labelKey: "easy.side.settings", icon: Settings, match: (p) => p.startsWith("/settings") },
    { href: "/help", labelKey: "easy.side.help", icon: LifeBuoy, match: (p) => p.startsWith("/help") },
  ];
  const messages: SideItem = { href: "/messages", labelKey: "easy.side.messages", icon: MessageCircle, badgeKey: "messages", match: (p) => p.startsWith("/messages") };
  if (mode === "employer") {
    return {
      main: [
        { href: "/", labelKey: "easy.side.home", icon: LayoutDashboard, match: (p) => p === "/" || p === "/employer" },
        { ...AI_NAV, match: isAiPath },
        { href: "/employer/vacancies", labelKey: "easy.side.my_vacancies", icon: BriefcaseBusiness, match: (p) => p.startsWith("/employer/vacancies") || p.startsWith("/post/vacancy") },
        { href: "/employer/applications", labelKey: "easy.side.applications", icon: Inbox, badgeKey: "applications", match: (p) => p.startsWith("/employer/applications") },
        {
          href: "/search?mode=workers",
          labelKey: "easy.side.candidates",
          icon: Users,
          match: (p) => p.startsWith("/search") || p.startsWith("/workers") || p.startsWith("/listing") || p.startsWith("/employer/saved") || p.startsWith("/employer/candidates"),
        },
        messages,
        { href: "/company/settings", labelKey: "easy.side.company", icon: Building2, match: (p) => p.startsWith("/company") },
        { href: "/cabinet", labelKey: "easy.side.profile", icon: User, match: (p) => p.startsWith("/cabinet") || p.startsWith("/profile") || p.startsWith("/billing") || p.startsWith("/ai-alerts") || p.startsWith("/offers") },
      ],
      more,
    };
  }
  return {
    main: [
      { href: "/", labelKey: "easy.side.home", icon: LayoutDashboard, match: (p) => p === "/" },
      { ...AI_NAV, match: isAiPath },
      {
        href: "/jobs",
        labelKey: "easy.side.vacancies",
        icon: Search,
        match: (p) => p.startsWith("/jobs") || p.startsWith("/search") || p.startsWith("/listing") || p.startsWith("/students") || p.startsWith("/ai-alerts") || p.startsWith("/cabinet/matches"),
      },
      { href: "/applications", labelKey: "easy.side.my_applications", icon: FileCheck2, badgeKey: "offers", match: (p) => p.startsWith("/applications") || p.startsWith("/offers") },
      { href: "/saved", labelKey: "easy.side.saved", icon: Bookmark, match: (p) => p.startsWith("/saved") },
      messages,
      {
        href: "/cabinet",
        labelKey: "easy.side.profile",
        icon: User,
        match: (p) => (p.startsWith("/cabinet") && !p.startsWith("/cabinet/matches")) || p.startsWith("/profile") || p.startsWith("/billing") || p.startsWith("/post"),
      },
    ],
    more,
  };
}

export function SideNav({
  counts,
  mode = null,
  user,
  social = [],
}: {
  mode?: NavMode;
  counts?: Partial<Record<NonNullable<NavItem["badgeKey"]>, number>>;
  user?: TopBarUser | null;
  social?: SocialLink[];
}) {
  const pathname = usePathname();
  const { t } = useT();
  const { main, more } = sideNav(mode);
  const post = postAction(mode);
  const link = (item: SideItem) => {
    const active = item.match(pathname);
    const badge = item.badgeKey ? counts?.[item.badgeKey] : undefined;
    return (
      <li key={item.href}>
        <Link
          href={item.href}
          aria-current={active ? "page" : undefined}
          {...(item.href === AI_NAV.href ? { "data-ai-entry": true, "data-track": "ai_entry", "data-track-to": "side" } : {})}
          className={cn(
            "flex h-11 items-center gap-3 rounded-md px-3 text-sm transition-colors",
            active ? "bg-sidebar-active font-medium text-navy-foreground" : "text-navy-muted hover:bg-navy-foreground/5 hover:text-navy-foreground",
          )}
        >
          <item.icon className={cn("size-4 shrink-0", active ? "text-sidebar-accent" : "opacity-80")} aria-hidden />
          <span className="min-w-0 flex-1 truncate">{t(item.labelKey)}</span>
          {badge ? (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-2xs font-semibold text-destructive-foreground">{badge > 99 ? "99+" : badge}</span>
          ) : null}
        </Link>
      </li>
    );
  };
  const name = user ? `${user.firstName} ${user.lastName}`.trim() : "";
  return (
    // "SAT MASTER" uslubi (2026-11): ekranning butun balandligidagi to'q ko'k ustun — logotip, bildirishnomalar, asosiy amal,
    // bo'limlar; pastda — sozlamalar, til va foydalanuvchi kartasi (rejimni almashtirish, chiqish)
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-navy lg:flex" style={{ paddingTop: "var(--safe-top)" }}>
      <div className="flex h-16 shrink-0 items-center gap-2 px-5">
        <Link href="/" className="flex min-h-11 min-w-0 items-center gap-2 rounded-md" aria-label={BRAND.name}>
          <BrandMark className="size-8" sizes="32px" />
          <span className="truncate font-display text-md font-semibold tracking-tight text-navy-foreground">{BRAND.name}</span>
        </Link>
        <Link
          href="/notifications"
          aria-label={t("common.nav.notifications")}
          className="relative ml-auto inline-flex size-11 items-center justify-center rounded-md text-navy-muted hover:bg-navy-foreground/10 hover:text-navy-foreground"
        >
          <Bell className="size-4.5" aria-hidden />
          {counts?.notifications ? <span className="absolute right-2.5 top-2.5 size-2 rounded-full bg-destructive" aria-hidden /> : null}
        </Link>
      </div>
      {pathname.startsWith("/post/") ? null : (
        <div className="px-3 pb-3">
          <Link
            href={post.href}
            data-track="nav_post"
            data-track-to="side"
            className="flex h-11 items-center justify-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover"
          >
            <Plus className="size-4" aria-hidden />
            {t(post.ctaKey)}
          </Link>
        </div>
      )}
      <nav aria-label={t("easy.side.label")} className="flex-1 space-y-5 overflow-y-auto px-3 pb-4">
        <ul className="space-y-0.5">{main.map(link)}</ul>
        {/* "Universal ustalar" — alohida mini-ilova, turkuaz rangda ajralib turadi */}
        <Link
          href="/ustalar"
          data-track="masters_entry"
          data-masters-entry
          aria-current={pathname.startsWith("/ustalar") ? "page" : undefined}
          className="flex h-11 items-center gap-3 rounded-md bg-accent-bright/15 px-3 text-sm font-semibold text-accent-bright ring-1 ring-accent-bright/40 transition-colors hover:bg-accent-bright/25"
        >
          <Wrench className="size-4 shrink-0" aria-hidden />
          <span className="min-w-0 flex-1 truncate">{t("masters.name")}</span>
        </Link>
        <div>
          <p className="mb-1.5 px-3 text-xs font-medium text-navy-muted/60">{t("easy.side.more")}</p>
          <ul className="space-y-0.5">{more.map(link)}</ul>
        </div>
        {/* rasmiy Telegram kanal va Instagram — bosilsa yangi oynada */}
        <SocialLinks links={social} tone="dark" compact />
      </nav>
      {user ? (
        <div className="shrink-0 space-y-2 border-t border-navy-line px-3 py-3">
          <LanguageSelect tone="dark" className="w-full" />
          <UserMenu
            variant="sidebar"
            name={name}
            subtitle={t(mode === "employer" ? "easy.side.mode_employer" : "easy.side.mode_worker")}
            roles={user.roles}
            activeRole={user.activeRole}
            avatar={
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-navy-foreground/10 text-sub font-semibold text-navy-foreground" aria-hidden>
                {initials(user.firstName, user.lastName)}
              </span>
            }
          />
        </div>
      ) : null}
    </aside>
  );
}
