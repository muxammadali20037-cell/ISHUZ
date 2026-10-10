import { cookies } from "next/headers";
import Link from "next/link";
import { Bell, Bookmark, MessageCircle } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { getSession } from "@/features/auth/session";
import { createClient } from "@/lib/supabase/server";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { initials } from "@/lib/format";
import { LanguageSelect } from "./language-switcher";
import { SoundToggle } from "./sound-toggle";
import { DesktopNavLinks, type NavRole } from "./app-shell";
import { UserMenu } from "./user-menu";
import { LoginLink } from "./login-link";
import { BrandMark } from "@/components/shared/brand-mark";

/** Yuqori panel (barcha sahifalarda). Server komponent: sessiyani o'qiydi. */
export async function TopBar({ role, counts }: { role: NavRole; counts?: { messages?: number; offers?: number; notifications?: number } }) {
  const { t } = await getT();
  const session = await getSession();
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-card/90 backdrop-blur supports-[backdrop-filter]:bg-card/80" style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
      <div className="container-app flex h-14 items-center gap-3">
        <Link href="/" className="flex min-h-11 items-center gap-2 font-extrabold tracking-tight" aria-label="Ish topdim">
          <BrandMark />
          <span className="hidden text-lg min-[400px]:inline">
            Ish <span className="text-primary">topdim</span>
          </span>
        </Link>
        <div className="ml-4 flex-1">
          <DesktopNavLinks role={role} counts={counts} />
        </div>
        <div className="flex items-center gap-1.5">
          <SoundToggle />
          <LanguageSelect />
          {session ? (
            <>
              <Button asChild variant="ghost" size="icon-sm" className="relative" aria-label={t("common.nav.messages")}>
                <Link href="/messages">
                  <MessageCircle className="size-5" />
                  {counts?.messages ? (
                    <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white">
                      {counts.messages > 99 ? "99+" : counts.messages}
                    </span>
                  ) : null}
                </Link>
              </Button>
              {role === "employer" ? (
                <Button asChild variant="ghost" size="icon-sm" className="relative hidden sm:inline-flex" aria-label={t("common.nav.saved")}>
                  <Link href="/employer/saved">
                    <Bookmark className="size-5" />
                  </Link>
                </Button>
              ) : null}
              <Button asChild variant="ghost" size="icon-sm" className="relative" aria-label={t("common.nav.notifications")}>
                <Link href="/notifications">
                  <Bell className="size-5" />
                  {counts?.notifications ? <span className="absolute right-1 top-1 size-2 rounded-full bg-destructive" /> : null}
                </Link>
              </Button>
              <UserMenu
                name={`${session.profile.first_name} ${session.profile.last_name}`.trim()}
                roles={session.roles}
                activeRole={session.activeRole}
                avatar={
                  <Avatar src={session.profile.avatar_url} fallback={initials(session.profile.first_name, session.profile.last_name)} size="sm" />
                }
              />
            </>
          ) : (
            <Button asChild className="h-11 px-4 text-base">
              <LoginLink>{t("common.nav.login")}</LoginLink>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}

export async function unreadCounts() {
  // sessiya bilan parallel chaqirish uchun: kirish cookie'si bo'lmasa — so'rov yo'q
  const jar = await cookies();
  if (!jar.getAll().some((c) => /^sb-.+-auth-token/.test(c.name))) return undefined;
  const supabase = await createClient();
  const { data } = await supabase.rpc("unread_counts").maybeSingle();
  if (!data) return undefined;
  return {
    notifications: Number(data.notifications ?? 0),
    messages: Number(data.messages ?? 0),
    applications: Number(data.applications ?? 0),
    offers: Number(data.offers ?? 0),
  };
}
