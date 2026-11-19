"use client";

import { SocialLinks } from "./social-links";
import { NewDot } from "./new-badge";
import type { SocialLink } from "@/lib/social";
import { useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, BriefcaseBusiness, Building2, House, LayoutDashboard, LayoutGrid, MessageCircle, Plus, Search, Sparkles, User, Users, Wrench, type LucideIcon } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import { initials } from "@/lib/format";
import { BRAND } from "@/config/brand";
import { BrandMark } from "@/components/shared/brand-mark";
import { LanguageSelect } from "./language-switcher";
import { UserMenu } from "./user-menu";
import type { TopBarUser } from "./top-bar";
import { HOME_ITEM, MORE_ITEMS, isAiPath, mainItems, type MenuItem } from "./nav-items";
import { usePendingPath } from "./nav-pending";

export type NavRole = "worker" | "employer" | "guest";
export type NavMode = "worker" | "employer" | null;

interface NavItem {
  /** tanishtiruv (features/tour) maqsadi: [data-tour] */
  tour?: string;
  href: string;
  labelKey: string;
  icon: LucideIcon;
  badgeKey?: "messages" | "applications" | "offers" | "notifications";
  match?: (path: string) => boolean;
}

/**
 * Rolga xos navigatsiya (2026-10 redizayn):
 *   Ish qidiruvchi (va rejim tanlamagan mehmon): Bosh sahifa · Ishlar · Ish beruvchilar · Xabarlar · Profil
 *   Ish beruvchi:                                Boshqaruv · E'lonlarim · [E'lon] · Ishchilar · Profil
 * 2026-11-18 (ega): ish beruvchida "Vakansiyalar" → "E'lonlarim"; "Nomzodlar" → "Ishchilar" — darhol barcha ishchi e'lonlari
 * (butun O'zbekiston, filtrlar natijalar sahifasida). Ish izlovchida o'rtadagi "Arizalar" → "Ish beruvchilar" (/companies,
 * alohida belgi — bino); arizalar — bosh sahifadagi "Arizalarim" qatori va Profilda, takliflar belgisi — Profilda.
 * Chat va bildirishnomalar — yuqori panelda. AI qidiruv — qidiruv yonida ("AI bilan qidirish"), AI sahifalari "Ishlar" ichida.
 * Takliflar (ish beruvchidan) — "Arizalar" bilan birga. Eski manzillar (/search, /cabinet, /saved, /applications, /employer…) o'zgarmagan.
 */
const PROFILE_PATHS = ["/cabinet", "/profile", "/settings", "/notifications", "/billing", "/help", "/messages"];

/**
 * "Yordamchi" (avval "AI yordamchi", "Barchasi siz uchun") — alohida bo'lim: kompyuterda yon menyu va yuqori menyuda "Bosh sahifa"dan keyin;
 * telefonda — yuqori paneldagi belgi (top-bar) va bosh sahifa menyusida (pastki menyuda joy yo'q: 5 ta katak).
 */
const AI_NAV: NavItem = { href: "/ai", labelKey: "easy.aiws.nav.ai", icon: Sparkles, match: isAiPath, tour: "ai" };

/**
 * Mehmon (hisobga kirmagan) ish izlovchi: "Xabarlar" o'rniga "Sohalar" (ega, 2026-11-17: "har bir soha qator bo'lib, eng ko'p
 * ish o'rni bori tepada, tagida nechta ish o'rni; hisobga kirmaganlarga — shunaqa, kirganlarga — o'zgarmasin")
 */
const FIELDS_NAV: NavItem = { tour: "fields", href: "/sohalar", labelKey: "easy.nav.tab_fields", icon: LayoutGrid, match: (p) => p.startsWith("/sohalar") || p.startsWith("/kasblar") };

function mainNav(mode: NavMode, guest = false): NavItem[] {
  if (mode === "employer") {
    return [
      { tour: "dashboard", href: "/", labelKey: "easy.nav.tab_dashboard", icon: LayoutDashboard, match: (p) => p === "/" || p === "/employer" },
      {
        tour: "my-listings",
        href: "/employer/vacancies",
        labelKey: "easy.nav.tab_my_listings",
        icon: BriefcaseBusiness,
        badgeKey: "applications",
        match: (p) => p.startsWith("/employer/vacancies") || p.startsWith("/employer/applications") || p.startsWith("/post/vacancy"),
      },
      {
        tour: "workers",
        href: "/search?mode=workers&any=1&region=all",
        labelKey: "easy.nav.tab_workers",
        icon: Users,
        match: (p) => p.startsWith("/search") || p.startsWith("/workers") || p.startsWith("/listing") || p.startsWith("/employer/saved") || p.startsWith("/employer/candidates"),
      },
      {
        tour: "profile",
        href: "/cabinet",
        labelKey: "easy.nav.tab_profile",
        icon: User,
        match: (p) => PROFILE_PATHS.some((x) => p.startsWith(x)) || p.startsWith("/ai") || p.startsWith("/company") || p.startsWith("/offers"),
      },
    ];
  }
  // 4.0 (ega "MASTER PROMPT", 2026-11-16): Bosh sahifa · Ishlar · Arizalar · Xabarlar · Profil. "Saqlanganlar" va
  // "O'zim haqimda e'lon" — Profil (Kabinetim) va bosh sahifa "Bo'limlar" menyusida (o'chirilmadi)
  return [
    { tour: "home", href: "/", labelKey: "easy.nav.tab_home_page", icon: House, match: (p) => p === "/" || p === "/ai" },
    {
      tour: "jobs",
      href: "/jobs",
      labelKey: "easy.nav.tab_jobs",
      icon: Search,
      match: (p) => p.startsWith("/search") || p.startsWith("/jobs") || p.startsWith("/listing") || p.startsWith("/students") || p.startsWith("/ai-alerts") || p.startsWith("/cabinet/matches"),
    },
    {
      tour: "employers",
      href: "/companies",
      labelKey: "easy.nav.tab_employers",
      icon: Building2,
      match: (p) => p.startsWith("/companies") || (p.startsWith("/company/") && !p.startsWith("/company/settings") && !p.startsWith("/company/join")),
    },
    guest ? FIELDS_NAV : { tour: "messages", href: "/messages", labelKey: "easy.nav.tab_messages", icon: MessageCircle, badgeKey: "messages", match: (p) => p.startsWith("/messages") },
    {
      tour: "profile",
      href: "/cabinet",
      labelKey: "easy.nav.tab_profile",
      icon: User,
      // yangi takliflar (ish beruvchidan) belgisi — Profilda: arizalar va takliflar shu yerda
      badgeKey: "offers",
      match: (p) =>
        (PROFILE_PATHS.some((x) => p.startsWith(x)) && !p.startsWith("/cabinet/matches") && !p.startsWith("/messages")) ||
        p.startsWith("/post") ||
        p.startsWith("/saved") ||
        p.startsWith("/applications") ||
        p.startsWith("/offers"),
    },
  ];
}

/** Markaziy "E'lon" tugmasi (OLX/super-ilovalar uslubi): ish qidiruvchi — o'zi haqida e'lon (CV), ish beruvchi — vakansiya */
export function postAction(mode: NavMode): { href: string; labelKey: string; ctaKey: string } {
  return mode === "employer"
    ? { href: "/post/vacancy", labelKey: "easy.nav.tab_post", ctaKey: "easy.start.post_vacancy" }
    : // ega (2026-11-17): "+ E'lon joylash" — yordamchi bilan (kasbni yozadi, oyna, "Tasdiqlash", "Joylash")
      { href: "/ai/post", labelKey: "easy.nav.tab_post", ctaKey: "easy.nav.post_worker_cta" };
}

export function BottomNav({ counts, mode = null, role }: { role: NavRole; mode?: NavMode; counts?: Partial<Record<NonNullable<NavItem["badgeKey"]>, number>> }) {
  // bosilgan bo'lim darhol belgilanadi (sahifa hali ochilmagan bo'lsa ham)
  const pendingPath = usePendingPath();
  const currentPath = usePathname();
  const pathname = pendingPath ?? currentPath;
  const { t } = useT();
  const items = mainNav(mode, role === "guest");
  const post = postAction(mode);
  const postActive = pathname.startsWith(post.href);
  // o'rtada — "E'lon" (2 ta bo'lim · E'lon · 2 ta bo'lim): ko'k pilyula, menyu ichida (yozuvni to'smaydi). Hamma bo'limda belgi
  // maydoni bir xil balandlikda (h-8) — nomlar bitta chiziqda turadi
  // ish beruvchi: o'rtada "E'lon" (vakansiya); ish qidiruvchi (4.0): beshta bo'lim, "E'lon" — Profilda
  const cells: (NavItem | "post")[] = mode === "employer" ? [...items.slice(0, 2), "post", ...items.slice(2)] : items;
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
              // min-w-0 + truncate: ruscha va katta shriftda (150%) beshta nom ekranga sig'adi — menyu yonga surilmaydi
              <li key="post" className="flex min-w-0 flex-1 justify-center">
                <Link
                  href={post.href}
                  aria-current={postActive ? "page" : undefined}
                  data-track="nav_post"
                  data-tour="post"
                  className="press flex h-full w-full min-w-0 flex-col items-center justify-center gap-0.5 text-2xs font-medium text-primary-ink"
                >
                  <span className="flex h-8 w-12 items-center justify-center rounded-md bg-primary text-primary-foreground" aria-hidden>
                    <Plus className="size-5" strokeWidth={2.5} />
                  </span>
                  <span className="max-w-full truncate tracking-tight">{t(post.labelKey)}</span>
                </Link>
              </li>
            );
          }
          const active = item.match ? item.match(pathname) : pathname === item.href;
          const badge = item.badgeKey ? counts?.[item.badgeKey] : undefined;
          return (
            <li key={item.href} className="min-w-0 flex-1">
              <Link
                href={item.href}
                data-tour={item.tour}
                className={cn("press relative flex h-full min-w-0 flex-col items-center justify-center gap-0.5 text-2xs font-medium", active ? "text-primary-ink" : "text-muted-foreground hover:text-foreground")}
                aria-current={active ? "page" : undefined}
              >
                <span className="flex h-8 items-center" aria-hidden>
                  <item.icon className="size-5" strokeWidth={active ? 2.25 : 1.75} />
                </span>
                <span className="max-w-full truncate tracking-tight">{t(item.labelKey)}</span>
                {/* 3.0: faol bo'lim ostida ko'k chiziq (namunadagidek) */}
                {active ? <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-primary" aria-hidden /> : null}
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
  // bosilgan bo'lim darhol belgilanadi (sahifa hali ochilmagan bo'lsa ham)
  const pendingPath = usePendingPath();
  const currentPath = usePathname();
  const pathname = pendingPath ?? currentPath;
  const { t } = useT();
  // "AI yordamchi" — birinchi bo'limdan keyin; /ai ochiq bo'lsa faqat u belgilanadi (telefonda /ai — "Ishlar"/"Profil" ichida)
  // "Xabarlar" — kompyuterda yuqori panel belgisida (bu qatorda takrorlanmaydi)
  const [first, ...rest] = mainNav(mode).filter((i) => i.href !== "/messages");
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
              data-tour={item.tour}
              {...(item === AI_NAV ? { "data-ai-entry": true, "data-track": "ai_entry", "data-track-to": "top" } : {})}
              className={cn(
                // 5.0: to'liq yumaloq (pill) tugma — belgi + matn; faol bo'lim och ko'k fonda
                "relative flex min-h-11 min-w-11 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-semibold transition-colors",
                active ? "bg-primary-soft text-primary-ink" : "text-muted-foreground hover:bg-secondary hover:text-foreground",
              )}
            >
              <item.icon className="size-4" aria-hidden />
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
 * ko'k plita. Bo'limlar ro'yxati — nav-items.ts (telefondagi bosh sahifa menyusi bilan bitta manba); pastda — Sozlamalar,
 * Yordam (asosiy amal — yuqori paneldagi tugma). Telefon va planshetda — pastki va yuqori menyu hamda bosh sahifa menyusi.
 * Hisoblagichlar — haqiqiy o'qilmaganlar (yuqori paneldagi bilan bir xil).
 */
function sideNav(mode: NavMode): { main: MenuItem[]; more: MenuItem[] } {
  return { main: [HOME_ITEM(mode), ...mainItems(mode)], more: MORE_ITEMS };
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
  // bosilgan bo'lim darhol belgilanadi (sahifa hali ochilmagan bo'lsa ham)
  const pendingPath = usePendingPath();
  const currentPath = usePathname();
  const pathname = pendingPath ?? currentPath;
  const { t } = useT();
  const { main, more } = sideNav(mode);
  const post = postAction(mode);
  const link = (item: MenuItem) => {
    const active = item.match(pathname);
    const badge = item.badgeKey ? counts?.[item.badgeKey] : undefined;
    // "Yordamchi" — to'q sariq rangda ajralib turadi ("Universal ustalar" turkuaz bo'lgani kabi)
    const ai = item.tone === "ai";
    return (
      <li key={item.href}>
        <Link
          href={item.href}
          aria-current={active ? "page" : undefined}
          {...(ai ? { "data-ai-entry": true, "data-track": "ai_entry", "data-track-to": "side" } : {})}
          className={cn(
            "flex h-11 items-center gap-3 rounded-md px-3 text-sm transition-colors",
            ai
              ? cn(
                  // bo'rtib turadi: rangli halqa + yumshoq to'q sariq soya, ustiga kelganda biroz ko'tariladi
                  "font-semibold text-ai-bright shadow-md shadow-ai-bright/20 ring-1 ring-ai-bright/40 transition hover:-translate-y-px",
                  active ? "bg-ai-bright/25" : "bg-ai-bright/15 hover:bg-ai-bright/25",
                )
              : active
                ? "bg-sidebar-active font-medium text-navy-foreground"
                : "text-navy-muted hover:bg-navy-foreground/5 hover:text-navy-foreground",
          )}
        >
          <item.icon className={cn("size-4 shrink-0", ai ? "" : active ? "text-sidebar-accent" : "opacity-80")} aria-hidden />
          <span className="min-w-0 flex-1 truncate">{t(item.labelKey)}</span>
          {item.fresh ? <NewDot feature={item.fresh} className={ai ? undefined : "text-sidebar-accent"} /> : null}
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
          className="flex h-11 items-center gap-3 rounded-md bg-accent-bright/15 px-3 text-sm font-semibold text-accent-bright shadow-md shadow-accent-bright/20 ring-1 ring-accent-bright/40 transition hover:-translate-y-px hover:bg-accent-bright/25"
        >
          <Wrench className="size-4 shrink-0" aria-hidden />
          <span className="min-w-0 flex-1 truncate">{t("masters.name")}</span>
          <NewDot feature="masters" />
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
