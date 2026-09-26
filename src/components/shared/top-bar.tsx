import Link from "next/link";
import { Bell, Bookmark } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { getSession } from "@/features/auth/session";
import { createClient } from "@/lib/supabase/server";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { initials } from "@/lib/format";
import { LanguageSwitcher } from "./language-switcher";
import { DesktopNavLinks, type NavRole } from "./app-shell";
import { UserMenu } from "./user-menu";

/** Yuqori panel (barcha sahifalarda). Server komponent: sessiyani o'qiydi. */
export async function TopBar({ role, counts }: { role: NavRole; counts?: { messages?: number; offers?: number; notifications?: number } }) {
  const { t } = await getT();
  const session = await getSession();
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-card/90 backdrop-blur supports-[backdrop-filter]:bg-card/80" style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
      <div className="container-app flex h-14 items-center gap-3">
        <Link href={role === "employer" ? "/employer" : "/"} className="flex items-center gap-2 font-extrabold tracking-tight">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-sm text-primary-foreground">IU</span>
          <span className="text-lg">
            ISH<span className="text-primary">.UZ</span>
          </span>
        </Link>
        <div className="ml-4 flex-1">
          <DesktopNavLinks role={role} counts={counts} />
        </div>
        <div className="flex items-center gap-1.5">
          <LanguageSwitcher className="hidden sm:inline-flex" />
          {session ? (
            <>
              <Button asChild variant="ghost" size="icon-sm" className="relative" aria-label={t("common.nav.saved")}>
                <Link href={role === "employer" ? "/employer/saved" : "/saved"}>
                  <Bookmark className="size-5" />
                </Link>
              </Button>
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
                isAdmin={session.isAdmin}
                avatar={
                  <Avatar src={session.profile.avatar_url} fallback={initials(session.profile.first_name, session.profile.last_name)} size="sm" />
                }
              />
            </>
          ) : (
            <Button asChild size="sm">
              <Link href="/auth">{t("common.nav.login")}</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}

export async function unreadCounts() {
  const session = await getSession();
  if (!session) return undefined;
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
