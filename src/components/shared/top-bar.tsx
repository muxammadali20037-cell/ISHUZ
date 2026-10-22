"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Bookmark, ChevronDown, MapPin, MessageCircle, Plus } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { initials } from "@/lib/format";
import { LanguageSelect } from "./language-switcher";
import { DesktopNavLinks, postAction, type NavMode, type NavRole } from "./app-shell";
import { UserMenu } from "./user-menu";
import { SiteMenu, SiteNavLinks, type SiteNavConfig } from "./site-nav";
import { LoginLink } from "./login-link";
import { BrandMark } from "@/components/shared/brand-mark";
import { BrandWordmark } from "@/components/shared/brand-wordmark";
import { BRAND } from "@/config/brand";
import { cn } from "@/lib/utils";

/** Yuqori paneldagi foydalanuvchi (sessiyadan, serverda tayyorlanadi) */
export interface TopBarUser {
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  roles: string[];
  activeRole: string | null;
}

export interface TopBarProps {
  role: NavRole;
  mode?: NavMode;
  counts?: { messages?: number; offers?: number; notifications?: number };
  user: TopBarUser | null;
  /** mehmon, rejim tanlanmagan: sayt bo'limlari (Bosh sahifa · Ishlar · Ishchilar · Xizmatlar · Biz haqimizda) va ro'yxatdan o'tish */
  site?: SiteNavConfig | null;
  /** ish qidiruvchi: eslab qolingan hudud — telefonda bosh sahifa panelida (kompyuterda u qidiruv blokida) */
  place?: { label: string; href: string } | null;
}

/**
 * Yuqori panel (barcha sahifalarda). Mijoz komponenti: ma'lumot serverda (Shell) tayyorlanadi, shuning uchun sahifa
 * yuklanayotganda ham (loading.tsx) o'sha panel joyida qoladi — AppFrame.
 */
export function TopBar({ role, counts, mode = null, user, site = null, place = null }: TopBarProps) {
  const { t } = useT();
  const pathname = usePathname();
  const session = user;
  // telefonda bosh sahifa paneli: logo · hudud · chat · bildirishnomalar (til — Profil → Sozlamalar, avatar — pastki "Profil")
  const showPlace = !!place && pathname === "/";
  return (
    // @container: katta shriftda (sarlavha 22rem dan tor) chat belgisi yashiriladi — xabarlar Kabinet va bildirishnomalarda
    <header className="@container sticky top-0 z-40 border-b border-border/70 bg-card" style={{ paddingTop: "var(--safe-top)" }}>
      <div className="container-app flex h-14 items-center gap-3">
        <Link href="/" className="flex min-h-11 min-w-11 items-center justify-center gap-2 font-extrabold tracking-tight" aria-label={BRAND.name}>
          <BrandMark className="size-10 rounded-xl" />
          {/* mehmonda joy yetadi — nom har doim; kirganda (chat, qo'ng'iroqcha, avatar) faqat 400 px dan */}
          <span
            className={cn(
              session ? "hidden text-lg min-[400px]:inline @max-[22rem]:hidden" : "text-lg @max-[22rem]:hidden",
              showPlace && "max-md:hidden",
            )}
          >
            <BrandWordmark />
            {/* kompyuterda nom ostida qisqa shior (mehmon sahifasida) */}
            {site ? <span className="hidden text-2xs font-semibold leading-none text-muted-foreground xl:block">{t("common.site.tagline")}</span> : null}
          </span>
        </Link>
        <div className={cn("ml-4 min-w-0 flex-1 @max-[22rem]:ml-0", showPlace && "max-md:ml-0")}>
          {site ? <SiteNavLinks pricing={site.pricing} /> : <DesktopNavLinks role={role} mode={mode} counts={counts} />}
          {showPlace ? (
            <Link
              href={place.href}
              prefetch={false}
              aria-label={t("easy.start.place_label", { place: place.label })}
              className="press flex min-h-11 max-w-full items-center gap-1 rounded-lg px-1.5 text-base font-semibold hover:bg-secondary md:hidden"
            >
              <MapPin className="size-4 shrink-0 text-primary" aria-hidden />
              <span className="truncate">{place.label}</span>
              <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            </Link>
          ) : null}
        </div>
        <div className="flex items-center gap-1">
          {/* kompyuterda — asosiy amal (telefonda pastki menyuning o'rtasida); bosh sahifada u sarlavhada bor */}
          {!site && !(pathname === "/" && mode === "employer") && !pathname.startsWith("/post/") ? (
            <Button asChild className="mr-1 hidden h-11 px-4 text-base font-bold lg:inline-flex">
              <Link href={postAction(mode).href} data-track="nav_post">
                <Plus className="size-5" aria-hidden />
                <span>{t(postAction(mode).ctaKey)}</span>
              </Link>
            </Button>
          ) : null}
          <LanguageSelect className={showPlace && session ? "max-md:hidden" : undefined} />
          {session ? (
            <>
              <Button asChild variant="ghost" size="icon" className="relative @max-[22rem]:hidden" aria-label={t("common.nav.messages")}>
                <Link href="/messages">
                  <MessageCircle className="size-5" />
                  {counts?.messages ? (
                    <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-2xs font-bold text-destructive-foreground">
                      {counts.messages > 99 ? "99+" : counts.messages}
                    </span>
                  ) : null}
                </Link>
              </Button>
              {role === "employer" ? (
                <Button asChild variant="ghost" size="icon" className="relative hidden sm:inline-flex" aria-label={t("common.nav.saved")}>
                  <Link href="/employer/saved">
                    <Bookmark className="size-5" />
                  </Link>
                </Button>
              ) : null}
              <Button asChild variant="ghost" size="icon" className="relative" aria-label={t("common.nav.notifications")}>
                <Link href="/notifications">
                  <Bell className="size-5" />
                  {counts?.notifications ? <span className="absolute right-1 top-1 size-2 rounded-full bg-destructive" /> : null}
                </Link>
              </Button>
              {/* telefonda profil — pastki menyuda ("Profil"): sarlavhada takrorlanmaydi */}
              <div className="hidden md:block">
                <UserMenu
                  name={`${session.firstName} ${session.lastName}`.trim()}
                  roles={session.roles}
                  activeRole={session.activeRole}
                  avatar={<Avatar src={session.avatarUrl} fallback={initials(session.firstName, session.lastName)} size="sm" />}
                />
              </div>
            </>
          ) : (
            <>
              <Button asChild variant="soft" className="h-11 px-4 text-base">
                <LoginLink>{t("common.nav.login")}</LoginLink>
              </Button>
              {site ? (
                <>
                  <Button asChild className="hidden h-11 px-4 text-base lg:inline-flex">
                    <Link href={site.registerHref}>{t("common.site.register")}</Link>
                  </Button>
                  <SiteMenu {...site} />
                </>
              ) : null}
            </>
          )}
        </div>
      </div>
    </header>
  );
}
