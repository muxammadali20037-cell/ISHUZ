import { getServerEnv } from "@/lib/env";
import { socialLinks } from "@/lib/social";
import { SocialLinks } from "@/components/shared/social-links";
import Link from "next/link";
import { Suspense } from "react";
import { Bell, BellRing, Bookmark, ChevronRight, FileText, Handshake, LifeBuoy, LogIn, LogOut, MessageCircle, Settings, ShieldCheck, Sparkles, UserRound, UsersRound, Wallet } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import type { SessionContext } from "@/features/auth/session";
import { signOut } from "@/features/auth/actions";
import { Button } from "@/components/ui/button";
import { getMyListings } from "../queries";
import { MyListingsSection } from "./my-listings";
import { AiProCard } from "@/features/ai-alerts/components/ai-pro-card";
import type { AppMode } from "@/features/mode/mode";
import { ProfileHeader } from "./profile-header";
import { Fold } from "@/components/shared/fold";
import { RoleSwitchRow } from "@/features/landing/role-switch-row";

/** Kabinetim: e'lonlarim (o'zgartirish, topdim), yangi e'lon va boshqa bo'limlar — hammasi bir joyda, ixcham */
export async function CabinetPage({ session, mode }: { session: SessionContext | null; mode: AppMode | null }) {
  const { t } = await getT();

  if (!session) {
    return (
      <div className="container-narrow space-y-5 py-8 text-lg">
        <h1 className="text-page font-extrabold sm:text-page-lg">{t("easy.cabinet.title")}</h1>
        <div className="space-y-4 rounded-2xl border border-border bg-card p-6">
          <h2 className="text-2xl font-bold">{t("easy.cabinet.guest_title")}</h2>
          <p className="text-muted-foreground">{t("easy.cabinet.guest_desc")}</p>
          <Button asChild size="xl" className="h-14 w-full text-lg">
            <Link href="/auth?next=%2Fcabinet">
              <LogIn className="size-5" aria-hidden /> {t("easy.cabinet.login")}
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const { workers, vacancies, paid } = await getMyListings(session);
  // bitta ro'yxat: faoliyat (arizalar, takliflar, saqlangan, xabarlar…), keyin hisob (profil, to'lovlar, sozlamalar)
  const links: { href: string; label: string; icon: typeof Bell; show: boolean }[] = [
    { href: "/applications", label: t("easy.cabinet.links.applications"), icon: FileText, show: !!session.workerId },
    { href: "/offers", label: t("easy.cabinet.links.offers"), icon: Handshake, show: !!session.workerId },
    { href: "/employer/applications", label: t("easy.cabinet.links.employer_applications"), icon: UsersRound, show: !!session.employerOnboarded },
    { href: "/saved", label: t("easy.cabinet.links.saved"), icon: Bookmark, show: true },
    { href: "/messages", label: t("easy.cabinet.links.messages"), icon: MessageCircle, show: true },
    { href: "/cabinet/matches", label: t("easy.cabinet.links.matches"), icon: Sparkles, show: !!(workers.length || vacancies.length) },
    { href: "/cabinet/alerts", label: t("easy.cabinet.links.alerts"), icon: BellRing, show: true },
    { href: "/profile", label: t("easy.cabinet.links.profile"), icon: UserRound, show: !!(session.workerOnboarded || session.employerId) },
    { href: "/cabinet/verification", label: t("easy.cabinet.links.verification"), icon: ShieldCheck, show: !!session.employerId || vacancies.length > 0 },
    { href: "/notifications", label: t("easy.cabinet.links.notifications"), icon: Bell, show: true },
    { href: "/billing", label: t("easy.cabinet.links.billing"), icon: Wallet, show: true },
    { href: "/settings", label: t("easy.cabinet.links.settings"), icon: Settings, show: true },
    // yordam — bosh sahifa bo'limlaridan shu yerga (2026-11-17: bosh sahifada takrorlanmasin)
    { href: "/help", label: t("easy.side.help"), icon: LifeBuoy, show: true },
  ];

  const roleTarget = mode === "employer" ? "worker" : "employer";

  return (
    // Profil — 3.0 (2026-11-17, ega: "profil juda chalkash; Mening dunyom, O'zim haqimda e'lon berish, Yordamchi, Universal
    // ustalar — olib tashla; qator soddalashtir"): rolni almashtirish, profil kartasi, e'lonlarim, PRO kuzatuv va bitta ro'yxat.
    // E'lon joylash — bosh sahifadagi katta tugma; Yordamchi va Universal ustalar — bosh sahifa bo'limlarida
    <div className="container-narrow space-y-4 py-6 text-lg sm:py-8">
      <h1 className="text-page font-extrabold sm:text-page-lg">{t("easy.cabinet.title")}</h1>
      <RoleSwitchRow
        tone="primary"
        target={roleTarget}
        title={t(roleTarget === "employer" ? "easy.side.switch.to_employer" : "easy.side.switch.to_worker")}
        hint={t("easy.cabinet.role_now", { role: t(roleTarget === "employer" ? "easy.cabinet.header.worker" : "easy.cabinet.header.employer") })}
      />
      {/* profil sarlavhasi — avatar, ism, rol, to'liqlik va faoliyat sonlari (haqiqiy) */}
      <Suspense fallback={<div className="h-44 animate-pulse rounded-2xl bg-secondary" aria-hidden />}>
        <ProfileHeader session={session} mode={mode} />
      </Suspense>

      <Fold name="my-listings" icon={<FileText />} tint="blue" verb="view" title={t("easy.cabinet.my_listings")} count={workers.length + vacancies.length || null}>
        <MyListingsSection workers={workers} vacancies={vacancies} paid={paid} />
      </Fold>

      <Fold name="pro" icon={<BellRing />} tint="orange" verb="open" title={t("easy.aihub.pro_title")}>
        <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-secondary" aria-hidden />}>
          <AiProCard userId={session.userId} only={mode} />
        </Suspense>
      </Fold>

      {/* bitta oddiy ro'yxat (ega, 2026-11-17: "profil juda chalkash — qator soddalashtir"): faoliyat va hisob, oxirida chiqish */}
      <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm" data-cabinet-links>
        {links
          .filter((l) => l.show)
          .map((l) => (
            <li key={l.href}>
              <Link href={l.href} className="press flex min-h-14 items-center gap-3 px-4 py-3 text-base font-semibold hover:bg-secondary/60">
                <l.icon className="size-6 shrink-0 text-primary-ink" aria-hidden />
                <span className="flex-1">{l.label}</span>
                <ChevronRight className="size-5 text-muted-foreground" aria-hidden />
              </Link>
            </li>
          ))}
        <li>
          <form action={signOut}>
            <button type="submit" className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left text-base font-semibold text-destructive hover:bg-destructive-soft/50">
              <LogOut className="size-6 shrink-0" aria-hidden />
              <span className="flex-1">{t("easy.cabinet.links.logout")}</span>
            </button>
          </form>
        </li>
      </ul>

      {/* telefonda yon menyu yo'q — rasmiy Telegram va Instagram shu yerda */}
      <SocialLinks links={socialLinks(getServerEnv())} className="rounded-2xl border border-border bg-card p-4" />
    </div>
  );
}
