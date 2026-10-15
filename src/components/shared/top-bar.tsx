"use client";

import Link from "next/link";
import { Bell, Bookmark, MessageCircle } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { initials } from "@/lib/format";
import { LanguageSelect } from "./language-switcher";
import { DesktopNavLinks, type NavMode, type NavRole } from "./app-shell";
import { UserMenu } from "./user-menu";
import { LoginLink } from "./login-link";
import { BrandMark } from "@/components/shared/brand-mark";
import { BrandWordmark } from "@/components/shared/brand-wordmark";
import { BRAND } from "@/config/brand";

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
}

/**
 * Yuqori panel (barcha sahifalarda). Mijoz komponenti: ma'lumot serverda (Shell) tayyorlanadi, shuning uchun sahifa
 * yuklanayotganda ham (loading.tsx) o'sha panel joyida qoladi — AppFrame.
 */
export function TopBar({ role, counts, mode = null, user }: TopBarProps) {
  const { t } = useT();
  const session = user;
  return (
    // @container: katta shriftda (sarlavha 22rem dan tor) chat belgisi yashiriladi — xabarlar Kabinet va bildirishnomalarda
    <header className="@container sticky top-0 z-40 border-b border-border/70 bg-card" style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
      <div className="container-app flex h-14 items-center gap-3">
        <Link href="/" className="flex min-h-11 min-w-11 items-center justify-center gap-2 font-extrabold tracking-tight" aria-label={BRAND.name}>
          <BrandMark />
          {/* mehmonda joy yetadi — nom har doim; kirganda (chat, qo'ng'iroqcha, avatar) faqat 400 px dan */}
          <span className={session ? "hidden text-lg min-[400px]:inline @max-[22rem]:hidden" : "text-lg @max-[22rem]:hidden"}>
            <BrandWordmark />
          </span>
        </Link>
        <div className="ml-4 min-w-0 flex-1 @max-[22rem]:ml-0">
          <DesktopNavLinks role={role} mode={mode} counts={counts} />
        </div>
        <div className="flex items-center gap-1">
          <LanguageSelect />
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
              <UserMenu
                name={`${session.firstName} ${session.lastName}`.trim()}
                roles={session.roles}
                activeRole={session.activeRole}
                avatar={<Avatar src={session.avatarUrl} fallback={initials(session.firstName, session.lastName)} size="sm" />}
              />
            </>
          ) : (
            <Button asChild variant="soft" className="h-11 px-4 text-base">
              <LoginLink>{t("common.nav.login")}</LoginLink>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
