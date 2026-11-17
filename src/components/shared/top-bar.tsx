"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Bookmark, MessageCircle, Plus, Sparkles } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { initials } from "@/lib/format";
import { LanguageSelect } from "./language-switcher";
import { GlobalBack } from "./global-back";
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
  /** kompyuterda chap yon menyu bor (kirgan foydalanuvchi): bo'lim havolalari faqat planshetda (md) */
  side?: boolean;
  /** telefonda ichki sahifalarda "‹ Orqaga" (menyusiz ustalarda — yo'q: ularda pastda katta "Orqaga" tugmasi) */
  back?: boolean;
  /** bosh sahifada telefonda sarlavha ostidagi doimiy qidiruv; ai — Yordamchi qidiruvi (admin o'chirmagan bo'lsa) */
  search?: { ai: boolean } | null;
}

/**
 * Yuqori panel (barcha sahifalarda). Mijoz komponenti: ma'lumot serverda (Shell) tayyorlanadi, shuning uchun sahifa
 * yuklanayotganda ham (loading.tsx) o'sha panel joyida qoladi — AppFrame.
 */
export function TopBar({ role, counts, mode = null, user, site = null, place = null, side = false, back = true, search = null }: TopBarProps) {
  const { t } = useT();
  const pathname = usePathname();
  const session = user;
  // telefonda bosh sahifa paneli: logo · hudud · chat · bildirishnomalar (til — Profil → Sozlamalar, avatar — pastki "Profil")
  // 5.0 (2026-11-16, ega "ko'k-oq" dizayni): joylashuv va qidiruv — bosh sahifaning qidiruv blokida (telefon va kompyuterda
  // bir xil tartib); sarlavhada takrorlanmaydi. `place` va `search` (Shell) endi sarlavhada ishlatilmaydi.
  void place;
  void search;
  return (
    // @container: katta shriftda (sarlavha 22rem dan tor) chat belgisi yashiriladi — xabarlar Kabinet va bildirishnomalarda
    <header
      // 5.0: yopishqoq, 64 px (telefonda 56 — birinchi ekranda 3 ta karta sig'sin), yarim shaffof oq + xiralashtirish, ostida nozik chiziq
      className={cn("@container glass-bar sticky top-0 z-40 border-b border-border/70", side && "lg:hidden")}
      style={{ paddingTop: "var(--safe-top)" }}
    >
      {/* yon menyu bo'lsa (kompyuter): panel to'liq kenglikda, logotip menyu ustida */}
      <div className="container-wide flex h-14 items-center gap-2 sm:h-16 sm:gap-3">
        {/* telefonda ichki sahifalarda — "‹ Orqaga" logotip oldida (Telegram ichida brauzer tugmasi ko'rinmaydi) */}
        {back ? <GlobalBack variant="bar" /> : null}
        <Link
          href="/"
          data-bar-logo
          className="flex min-h-11 min-w-11 items-center justify-center gap-2 font-extrabold tracking-tight"
          aria-label={BRAND.name}
        >
          <BrandMark className="size-9 shrink-0" sizes="36px" />
          {/* mehmonda joy yetadi — nom har doim; kirganda (chat, qo'ng'iroqcha, avatar) faqat 400 px dan. Joy yetmasa (katta
              shrift) — nom qisqaradi ("Ish to…"), qo'shni tugmalar ustiga chiqmaydi */}
          <span
            className={cn(
              "min-w-0 truncate",
              session ? "hidden text-lg min-[400px]:inline @max-[22rem]:hidden" : "whitespace-nowrap text-base sm:text-lg @max-[22rem]:hidden",
              // sayt menyusi (lg–xl): nom o'rniga faqat belgi — to'rt bo'lim va o'ngdagi tugmalar sig'sin
              site && "lg:max-xl:hidden",
            )}
          >
            <BrandWordmark />
            {/* shior sarlavhada yo'q (2026-10-31): to'rt bo'limli menyu va "Ish joylashtirish" sig'sin — shior footer'da */}
          </span>
        </Link>
        <div className="ml-4 min-w-0 flex-1 max-md:hidden">
          {site ? (
            <SiteNavLinks />
          ) : (
            <div className={side ? "lg:hidden" : undefined}>
              <DesktopNavLinks role={role} mode={mode} counts={counts} />
            </div>
          )}
        </div>
        {/* telefonda o'rtadagi bo'limlar yo'q (pastki menyuda) — o'ng guruh ml-auto bilan chetga */}
        <div className="ml-auto flex items-center gap-1">
          {/* kompyuterda — asosiy amal (telefonda pastki menyuning o'rtasida); bosh sahifada u sarlavhada bor */}
          {!site && !(pathname === "/" && mode === "employer") && !pathname.startsWith("/post/") ? (
            // 5.0: "E'lon berish" — ko'k gradientli yumaloq tugma
            <Link
              href={postAction(mode).href}
              data-track="nav_post"
              className="press brand-fill mr-1 hidden h-11 items-center gap-1.5 rounded-full px-4 text-sm font-bold shadow-glow hover:opacity-95 lg:inline-flex"
            >
              <Plus className="size-4" strokeWidth={2.5} aria-hidden />
              <span>{t("easy.nav.post_cta")}</span>
            </Link>
          ) : null}
          {/* telefonda (md dan tor): "AI yordamchi" — har sahifadan bir bosishda; kompyuterda u menyuda (yon yoki yuqori) */}
          {pathname === "/ai" ? null : (
            // rejim tanlamagan mehmon (sayt menyusi): telefonda belgi yo'q — "Yordamchi" ☰ menyuda (nom, til, Kirish sig'sin)
            <Button asChild variant="ghost" size="icon" className={cn("text-primary-ink hover:bg-primary-soft md:hidden", site && "max-sm:hidden")} aria-label={t("easy.aiws.nav.ai")}>
              <Link href="/ai" data-track="ai_entry" data-track-to="topbar" data-ai-entry>
                <Sparkles className="size-5" />
              </Link>
            </Button>
          )}
          <LanguageSelect />
          {session ? (
            <>
              {/* ish izlovchida telefonda yo'q — pastki menyuda "Xabarlar" bor (ega, 2026-11-17: takror — chalkash);
                  ish beruvchining pastki menyusida "Xabarlar" yo'q — unda qoladi */}
              <Button asChild variant="ghost" size="icon" className={cn("relative @max-[22rem]:hidden", mode !== "employer" && "max-md:hidden")} aria-label={t("common.nav.messages")}>
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
              <Button asChild variant="soft" className="h-11 rounded-full bg-secondary px-3 font-bold text-primary-ink hover:bg-primary-soft sm:px-4">
                <LoginLink>{t("common.nav.login")}</LoginLink>
              </Button>
              {site ? (
                <>
                  {/* kompyuterda: Kirish · Ish joylashtirish (asosiy amal). "Ro'yxatdan o'tish" — menyuda va "Kirish" oqimida
                      (telefon raqami bilan kirish = ro'yxatdan o'tish): to'rt bo'limli menyu bilan sarlavhaga sig'masdi */}
                  <Button asChild className="hidden h-11 px-4 lg:inline-flex">
                    <Link href="/post/vacancy" data-track="home_post_vacancy" data-track-to="header">
                      {t("common.site.post_job")}
                    </Link>
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
