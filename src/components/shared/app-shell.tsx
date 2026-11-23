"use client";

import { SocialLinks } from "./social-links";
import { NewDot } from "./new-badge";
import type { SocialLink } from "@/lib/social";
import { Suspense, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Bell, Plus, Wrench } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import { initials } from "@/lib/format";
import { BRAND } from "@/config/brand";
import { BrandMark } from "@/components/shared/brand-mark";
import { LanguageSelect } from "./language-switcher";
import { UserMenu } from "./user-menu";
import type { TopBarUser } from "./top-bar";
import { APP_CHAT, MORE_ITEMS, appSideItems, appTabs, type BadgeKey, type MenuItem } from "./nav-items";
import { usePendingPath } from "./nav-pending";

export type NavRole = "worker" | "employer" | "guest";
export type NavMode = "worker" | "employer" | null;
type Counts = Partial<Record<BadgeKey, number>>;

/**
 * Asosiy menyu (ega, 2026-11-21, master prompt): 3 ta bo'lim — Chat · E'lonlarim · Profil, ikkala rejimda bir xil.
 * Chat — ko'k pilyula (asosiy amal). Xabarlar va bildirishnomalar — yuqori panelda. Bo'limlar ro'yxati — nav-items.ts
 * (appTabs). Eski manzillar (/ai, /employer, /search…) o'zgarmagan.
 */

/** Markaziy "E'lon" tugmasi (kompyuter: yon menyu va yuqori panel): ish qidiruvchi — o'zi haqida e'lon (CV), ish beruvchi — vakansiya */
export function postAction(mode: NavMode): { href: string; labelKey: string; ctaKey: string } {
  return mode === "employer"
    ? { href: "/post/vacancy", labelKey: "easy.nav.tab_post", ctaKey: "easy.start.post_vacancy" }
    : // ega (2026-11-21, 3-bosqich): "+ E'lon joylash" — chatning o'zida (savollar bittadan, karta, "Joylash")
      { href: "/chat?post=new", labelKey: "easy.nav.tab_post", ctaKey: "easy.nav.post_worker_cta" };
}

/**
 * Hozirgi (yoki bosilgan, hali ochilmagan) sahifa: yo'l va /search dagi ?mode= ("Ishlar" yoki "Ishchilar").
 * Bosilgan havola so'rov qismi bilan yoziladi (nav-progress) — bo'lim darhol to'g'ri belgilanadi.
 */
function useNavPlace(find: string | null): { path: string; find: string | null } {
  const pendingPath = usePendingPath();
  const currentPath = usePathname();
  if (!pendingPath) return { path: currentPath, find };
  const [path, query = ""] = pendingPath.split("?");
  return { path: path || currentPath, find: new URLSearchParams(query).get("mode") };
}

/** ?mode= faqat brauzerda o'qiladi (useSearchParams) — Suspense ichida; u kelguncha /search "Ishlar" deb belgilanadi */
function WithFind({ children }: { children: (find: string | null) => ReactNode }) {
  return <Suspense fallback={children(null)}><FindParam>{children}</FindParam></Suspense>;
}
function FindParam({ children }: { children: (find: string | null) => ReactNode }) {
  const params = useSearchParams();
  return children(params.get("mode"));
}

/** `mode` — eski chaqiruvlar uchun: 2026-11-21 dan bo'limlar ikkala rejimda bir xil */
export function BottomNav({ counts }: { role: NavRole; mode?: NavMode; counts?: Counts }) {
  return <WithFind>{(find) => <BottomNavView counts={counts} find={find} />}</WithFind>;
}

function BottomNavView({ counts, find: urlFind }: { counts?: Counts; find: string | null }) {
  const { t } = useT();
  const { path, find } = useNavPlace(urlFind);
  return (
    <nav
      className="bottom-nav fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card md:hidden"
      style={{ paddingBottom: "var(--safe-bottom)" }}
      aria-label={t("common.nav.main_label")}
      data-app-tabs
    >
      <ul className="flex h-[var(--tabbar-height)] items-stretch">
        {appTabs().map((item) => {
          const active = item.match(path, find);
          const badge = item.badgeKey ? counts?.[item.badgeKey] : undefined;
          if (item === APP_CHAT) {
            // chat: ko'k pilyula (asosiy amal), menyu ichida — yozuvni to'smaydi
            return (
              // min-w-0 + truncate: ruscha va katta shriftda (150%) ham nomlar ekranga sig'adi — menyu yonga surilmaydi
              <li key={item.key} className="flex min-w-0 flex-1 justify-center">
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  data-track="nav_chat"
                  data-tour="chat"
                  data-tab={item.key}
                  // pilyula doim ko'k (asosiy amal); nomi faqat shu bo'lim ochiq bo'lsa ko'k — qaysi bo'lim faolligi chalkashmasin
                  className={cn("press flex h-full w-full min-w-0 flex-col items-center justify-center gap-0.5 text-2xs font-semibold", active ? "text-primary-ink" : "text-muted-foreground")}
                >
                  <span className={cn("flex h-8 w-12 items-center justify-center rounded-md text-primary-foreground", active ? "bg-primary-hover" : "bg-primary")} aria-hidden>
                    <item.icon className="size-5" strokeWidth={2.25} />
                  </span>
                  <span className="max-w-full truncate tracking-tight">{t(item.labelKey)}</span>
                </Link>
              </li>
            );
          }
          return (
            <li key={item.key} className="min-w-0 flex-1">
              <Link
                href={item.href}
                data-tour={item.key}
                data-tab={item.key}
                className={cn("press relative flex h-full min-w-0 flex-col items-center justify-center gap-0.5 text-2xs font-medium", active ? "text-primary-ink" : "text-muted-foreground hover:text-foreground")}
                aria-current={active ? "page" : undefined}
              >
                <span className="flex h-8 items-center" aria-hidden>
                  <item.icon className="size-5" strokeWidth={active ? 2.25 : 1.75} />
                </span>
                <span className="max-w-full truncate tracking-tight">{t(item.labelKey)}</span>
                {/* faol bo'lim ostida ko'k chiziq */}
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

/** Planshet (md) va kirmagan kompyuter uchun yuqori paneldagi bo'lim havolalari — telefondagi pastki menyu bilan bir xil */
export function DesktopNavLinks({ counts }: { role: NavRole; mode?: NavMode; counts?: Counts }) {
  return <WithFind>{(find) => <DesktopNavView counts={counts} find={find} />}</WithFind>;
}

function DesktopNavView({ counts, find: urlFind }: { counts?: Counts; find: string | null }) {
  const { t } = useT();
  const { path, find } = useNavPlace(urlFind);
  const items = appTabs();
  const [navRef, compact] = useFitLabels(items.map((i) => t(i.labelKey)).join("|"));
  return (
    <nav ref={navRef} aria-label={t("common.nav.main_label")} className="hidden md:block">
    <ul className="flex items-center gap-1">
      {items.map((item) => {
        const active = item.match(path, find);
        const badge = item.badgeKey ? counts?.[item.badgeKey] : undefined;
        return (
          <li key={item.key}>
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              title={t(item.labelKey)}
              data-tour={item.key}
              {...(item === APP_CHAT ? { "data-track": "nav_chat", "data-track-to": "top" } : {})}
              className={cn(
                // to'liq yumaloq (pill) tugma — belgi + matn; faol bo'lim och ko'k fonda
                "relative flex min-h-11 min-w-11 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-semibold transition-colors",
                active ? "bg-primary-soft text-primary-ink" : "text-muted-foreground hover:bg-secondary hover:text-foreground",
              )}
            >
              <item.icon className="size-4" aria-hidden />
              {/* planshetda (md) va joy yetmaganda — faqat belgi; nom ekran o'quvchisi va title uchun saqlanadi */}
              <span className={compact ? "sr-only" : "sr-only lg:not-sr-only"}>{t(item.labelKey)}</span>
              {badge ? <span className="ml-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-2xs font-bold text-destructive-foreground">{badge > 99 ? "99+" : badge}</span> : null}
            </Link>
          </li>
        );
      })}
      {/* "Universal ustalar" (turkuaz) — planshetda belgi bilan; kompyuterda yon menyuda */}
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
 * Kompyuter (lg+) uchun chap yon menyu — kirgan foydalanuvchi (2026-11-23, ega: "oynali", "A — och shisha" varianti): oynali
 * panel, faol bo'lim — och ko'k plita. Bo'limlar ro'yxati — nav-items.ts (telefondagi bosh sahifa menyusi bilan bitta manba); pastda — Sozlamalar,
 * Yordam (asosiy amal — yuqori paneldagi tugma). Telefon va planshetda — pastki va yuqori menyu hamda bosh sahifa menyusi.
 * Hisoblagichlar — haqiqiy o'qilmaganlar (yuqori paneldagi bilan bir xil).
 */
function sideNav(): { main: MenuItem[]; more: MenuItem[] } {
  return { main: appSideItems(), more: MORE_ITEMS };
}

type SideNavProps = { mode?: NavMode; counts?: Counts; user?: TopBarUser | null; social?: SocialLink[] };

export function SideNav(props: SideNavProps) {
  return <WithFind>{(find) => <SideNavView {...props} find={find} />}</WithFind>;
}

function SideNavView({ counts, mode = null, user, social = [], find: urlFind }: SideNavProps & { find: string | null }) {
  // bosilgan bo'lim darhol belgilanadi (sahifa hali ochilmagan bo'lsa ham)
  const { path: pathname, find } = useNavPlace(urlFind);
  const { t } = useT();
  const { main, more } = sideNav();
  const post = postAction(mode);
  // bo'lim qatori — hammasi bir xil rangda (ega, 2026-11-23: "ranglar ketma-ketligi"); tanlangani — och ko'k plita va chap chiziq
  const row = (active: boolean) =>
    // yozuv — to'q (shisha orqasidagi ko'k dog' ustida ham AA kontrast), belgi — kulrang
    cn("relative flex h-11 items-center gap-3 rounded-xl px-3 text-sm transition-colors", active ? "bg-primary-soft font-semibold text-primary-ink" : "text-foreground hover:bg-foreground/5");
  const bar = <span className="absolute inset-y-2.5 left-0 w-1 rounded-full bg-primary" aria-hidden />;
  const link = (item: MenuItem) => {
    const active = item.match(pathname, find);
    const badge = item.badgeKey ? counts?.[item.badgeKey] : undefined;
    return (
      <li key={item.href}>
        <Link href={item.href} aria-current={active ? "page" : undefined} {...(item === APP_CHAT ? { "data-track": "nav_chat", "data-track-to": "side" } : {})} className={row(active)}>
          {active ? bar : null}
          <item.icon className={cn("size-4.5 shrink-0", active ? "text-primary-ink" : "text-muted-foreground")} aria-hidden />
          <span className="min-w-0 flex-1 truncate">{t(item.labelKey)}</span>
          {item.fresh ? <NewDot feature={item.fresh} /> : null}
          {badge ? (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-2xs font-semibold text-destructive-foreground">{badge > 99 ? "99+" : badge}</span>
          ) : null}
        </Link>
      </li>
    );
  };
  const masters = pathname.startsWith("/ustalar");
  const name = user ? `${user.firstName} ${user.lastName}`.trim() : "";
  return (
    // ega (2026-11-23, variantlardan "A — och shisha"): ekran chetidan ajralgan yumaloq oynali (shisha) panel — orqasida ko'k,
    // sariq va turkuaz rangli xira dog'lar ko'rinib turadi. Ichida ranglar bir tartibda: asosiy amal ("E'lon berish") — sariq
    // (bosh sahifadagi tugma bilan bir xil), tanlangan bo'lim — och ko'k, qolganlari — bir xil kulrang. .side-glass — panel
    // ichidagi "navy" tokenlarini oddiy matn ranglariga o'tkazadi (til tanlash, ijtimoiy tarmoqlar, foydalanuvchi kartasi)
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 p-3 lg:flex" style={{ paddingTop: "calc(var(--safe-top) + 0.75rem)" }}>
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <span className="absolute -left-20 -top-16 size-64 rounded-full bg-primary/30 blur-3xl" />
        <span className="absolute -right-12 top-1/3 size-44 rounded-full bg-highlight/45 blur-3xl" />
        <span className="absolute -left-12 bottom-10 size-56 rounded-full bg-accent-bright/35 blur-3xl" />
      </div>
      <div className="side-glass relative flex w-full flex-col overflow-hidden rounded-2xl border border-card/80 bg-card/55 shadow-lg backdrop-blur-xl" data-side-glass>
        <div className="flex h-16 shrink-0 items-center gap-2 px-4">
          <Link href="/" className="flex min-h-11 min-w-0 items-center gap-2 rounded-md" aria-label={BRAND.name}>
            <BrandMark className="size-8" sizes="32px" />
            <span className="truncate font-display text-md font-semibold tracking-tight text-foreground">{BRAND.name}</span>
          </Link>
          <Link
            href="/notifications"
            aria-label={t("common.nav.notifications")}
            className="relative ml-auto inline-flex size-11 items-center justify-center rounded-xl text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
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
              className="flex h-11 items-center justify-center gap-2 rounded-xl bg-highlight px-3 text-sm font-bold text-highlight-foreground shadow-md transition-colors hover:bg-highlight-hover"
            >
              <Plus className="size-4.5" aria-hidden />
              {t(post.ctaKey)}
            </Link>
          </div>
        )}
        <nav aria-label={t("easy.side.label")} className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 pb-4">
          <ul className="space-y-1">{main.map(link)}</ul>
          {/* "Universal ustalar" — boshqa bo'limlar qatorida, bir xil rangda ("Yangi" nuqtasi bilan) */}
          <Link href="/ustalar" data-track="masters_entry" data-masters-entry aria-current={masters ? "page" : undefined} className={row(masters)}>
            {masters ? bar : null}
            <Wrench className={cn("size-4.5 shrink-0", masters ? "text-primary-ink" : "text-muted-foreground")} aria-hidden />
            <span className="min-w-0 flex-1 truncate">{t("masters.name")}</span>
            <NewDot feature="masters" />
          </Link>
          <div className="mt-2 border-t border-border pt-3">
            <ul className="space-y-1">{more.map(link)}</ul>
          </div>
          {/* rasmiy Telegram kanal va Instagram — bosilsa yangi oynada */}
          <div className="mt-2">
            <SocialLinks links={social} tone="light" compact />
          </div>
        </nav>
        {user ? (
          <div className="shrink-0 space-y-2 border-t border-border px-3 py-3">
            <LanguageSelect className="w-full" />
            <UserMenu
              variant="sidebar"
              name={name}
              subtitle={t(mode === "employer" ? "easy.side.mode_employer" : "easy.side.mode_worker")}
              roles={user.roles}
              activeRole={user.activeRole}
              avatar={
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sub font-semibold text-primary-ink" aria-hidden>
                  {initials(user.firstName, user.lastName)}
                </span>
              }
            />
          </div>
        ) : null}
      </div>
    </aside>
  );
}
