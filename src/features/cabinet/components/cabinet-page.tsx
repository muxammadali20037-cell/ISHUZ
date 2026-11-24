import { getServerEnv } from "@/lib/env";
import { socialLinks } from "@/lib/social";
import { SocialLinks } from "@/components/shared/social-links";
import Link from "next/link";
import { BadgeCheck, Bell, BellRing, Bookmark, ChevronRight, Languages, LifeBuoy, LogIn, LogOut, MessageCircle, Pencil, PhoneOff, Settings, ShieldCheck, UserRound, Wallet, Wrench } from "lucide-react";
import type { TFunction } from "@/lib/i18n/translate";
import { getT } from "@/lib/i18n/server";
import type { SessionContext } from "@/features/auth/session";
import { signOut } from "@/features/auth/actions";
import { Button } from "@/components/ui/button";
import { getMyListings } from "../queries";
import type { AppMode } from "@/features/mode/mode";
import { Avatar } from "@/components/ui/avatar";
import { createClient } from "@/lib/supabase/server";
import { formatPhone, initials } from "@/lib/format";
import { LOCALE_NAMES } from "@/lib/i18n/config";
import { Fold } from "@/components/shared/fold";
import { RoleSwitchRow } from "@/features/landing/role-switch-row";
import { MASTERS_ENABLED } from "@/features/masters/flags";

/** Profil (pastki menyuning 3-bo'limi): ism, telefon, til, chiqish; qolgani — "Boshqa sozlamalar" ichida */
export async function CabinetPage({ session, mode }: { session: SessionContext | null; mode: AppMode | null }) {
  const { t, locale } = await getT();

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
        {MASTERS_ENABLED ? <MastersRow t={t} /> : null}
      </div>
    );
  }

  const supabase = await createClient();
  const [{ vacancies, workers }, contactRes] = await Promise.all([
    getMyListings(session),
    supabase.from("profile_contacts").select("phone, phone_verified_at").eq("profile_id", session.userId).maybeSingle(),
  ]);
  const employer = mode === "employer" || (!mode && !session.workerId && !!session.employerId);
  const phone = contactRes.data?.phone ?? null;
  const fullName = [session.profile.first_name, session.profile.last_name].filter((x) => x?.trim()).join(" ") || t("easy.cabinet.title");
  // ismni o'zgartirish: ish izlovchi — shaxsiy ma'lumotlar, faqat ish beruvchi — kompaniya sozlamalari (/profile/edit shunga yo'naltiradi)
  const editHref = !session.workerId && session.employerId ? "/company/settings" : "/profile/edit";
  // qolgan hamma narsa — bitta yig'ma "Boshqa sozlamalar" ichida (hech narsa yo'qolmaydi)
  const links: { href: string; label: string; icon: typeof Bell; show: boolean }[] = [
    { href: "/saved", label: t("easy.cabinet.links.saved"), icon: Bookmark, show: true },
    { href: "/messages", label: t("easy.cabinet.links.messages"), icon: MessageCircle, show: true },
    { href: "/cabinet/alerts", label: t("easy.cabinet.links.alerts"), icon: BellRing, show: true },
    { href: "/profile", label: t("easy.cabinet.links.profile"), icon: UserRound, show: !!(session.workerOnboarded || session.employerId) },
    { href: "/cabinet/verification", label: t("easy.cabinet.links.verification"), icon: ShieldCheck, show: !!session.employerId || vacancies.length > 0 },
    { href: "/notifications", label: t("easy.cabinet.links.notifications"), icon: Bell, show: true },
    { href: "/billing", label: t("easy.cabinet.links.billing"), icon: Wallet, show: !employer },
    { href: "/settings", label: t("easy.cabinet.links.settings"), icon: Settings, show: true },
    { href: "/help", label: t("easy.side.help"), icon: LifeBuoy, show: true },
  ];

  const roleTarget = mode === "employer" ? "worker" : "employer";
  // 4-bosqich (ega, 2026-11-22): raqami yo'q ishchi e'loni qidiruvga chiqmaydi — egasiga Profilda ham eslatma
  const noPhone = workers.find((w) => w.phoneHidden);

  return (
    // Profil — 4.0 (ega, 2026-11-21, master prompt: "profil juda sodda bo'lsin: ism, telefon, til, e'lonlarim, chiqish;
    // ish beruvchiga — to'lovlar"). E'lonlar — pastki menyuning "E'lonlarim" bo'limida. Qolgan hamma narsa —
    // bitta yig'ma "Boshqa sozlamalar" ichida
    <div className="container-narrow space-y-4 py-6 text-lg sm:py-8" data-cabinet>
      <h1 className="text-page font-extrabold sm:text-page-lg">{t("easy.cabinet.title")}</h1>

      {/* tahrirlash tugmasi — burchakda (alohida ustun emas): katta shriftda (1.25×) telefon raqami tugma ostida qolardi
          (audit, 390 ru); endi matn ustuni butun kenglikda, faqat ism tugmaga joy qoldiradi */}
      <section aria-labelledby="cabinet-name" className="relative flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm" data-profile-card>
        <Avatar src={session.profile.avatar_url} fallback={initials(session.profile.first_name, session.profile.last_name)} size="lg" alt="" />
        <div className="min-w-0 flex-1">
          <h2 id="cabinet-name" className="pr-10 text-xl font-extrabold leading-tight [overflow-wrap:anywhere]">
            {fullName}
          </h2>
          <p className="text-sm text-muted-foreground">{employer ? t("easy.cabinet.header.employer") : t("easy.cabinet.header.worker")}</p>
          {phone ? (
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-base font-semibold" data-profile-phone>
              <span className="whitespace-nowrap tabular-nums">{formatPhone(phone)}</span>
              {contactRes.data?.phone_verified_at ? (
                <span className="inline-flex items-center gap-1 text-sm font-semibold text-success">
                  <BadgeCheck className="size-4" aria-hidden /> {t("easy.cabinet.phone_verified")}
                </span>
              ) : null}
            </p>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground" data-profile-phone="none">
              {t("easy.cabinet.phone_none")} ·{" "}
              <Link href="/settings" className="font-semibold text-primary-ink hover:underline">
                {t("easy.cabinet.phone_add")}
              </Link>
            </p>
          )}
        </div>
        <Link href={editHref} aria-label={t("easy.cabinet.edit_name")} title={t("easy.cabinet.edit_name")} className="press absolute right-2 top-2 flex size-11 items-center justify-center rounded-xl text-muted-foreground hover:bg-secondary hover:text-foreground">
          <Pencil className="size-5" aria-hidden />
        </Link>
      </section>

      {noPhone ? (
        <Link
          href={noPhone.primary ? "/post/worker?step=3" : `/post/worker?listing=${noPhone.id}&step=3`}
          role="status"
          data-cabinet-phone-missing
          className="press flex items-start gap-3 rounded-2xl border border-warning/40 bg-warning-soft p-4 text-base hover:bg-warning-soft/70"
        >
          <PhoneOff className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">{t("easy.cabinet.phone_banner")}</span>
            <span className="mt-1 inline-flex items-center gap-1 font-bold text-primary-ink">
              {t("easy.cabinet.phone_banner_cta")} <ChevronRight className="size-4" aria-hidden />
            </span>
          </span>
        </Link>
      ) : null}

      <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm" data-cabinet-main>
        <li>
          <Link href="/settings" data-cabinet-row="language" className="press flex min-h-14 items-center gap-3 px-4 py-3 text-base font-semibold hover:bg-secondary/60">
            <Languages className="size-6 shrink-0 text-primary-ink" aria-hidden />
            <span className="flex-1">{t("easy.cabinet.language_row")}</span>
            <span className="text-sm font-medium text-muted-foreground">{LOCALE_NAMES[locale]}</span>
            <ChevronRight className="size-5 text-muted-foreground" aria-hidden />
          </Link>
        </li>
        {employer ? (
          <li>
            <Link href="/billing" data-cabinet-row="billing" className="press flex min-h-14 items-center gap-3 px-4 py-3 text-base font-semibold hover:bg-secondary/60">
              <Wallet className="size-6 shrink-0 text-primary-ink" aria-hidden />
              <span className="flex-1">{t("easy.cabinet.links.billing")}</span>
              <ChevronRight className="size-5 text-muted-foreground" aria-hidden />
            </Link>
          </li>
        ) : null}
      </ul>

      <Fold name="more" icon={<Settings />} tint="blue" verb="open" title={t("easy.cabinet.more_settings")}>
        <div className="space-y-3">
          {MASTERS_ENABLED ? <MastersRow t={t} /> : null}
          <RoleSwitchRow
            tone="neutral"
            target={roleTarget}
            title={t(roleTarget === "employer" ? "easy.side.switch.to_employer" : "easy.side.switch.to_worker")}
            hint={t("easy.cabinet.role_now", { role: t(roleTarget === "employer" ? "easy.cabinet.header.worker" : "easy.cabinet.header.employer") })}
          />
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border/70 bg-card" data-cabinet-links>
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
          </ul>
          {/* telefonda yon menyu yo'q — rasmiy Telegram va Instagram shu yerda */}
          <SocialLinks links={socialLinks(getServerEnv())} className="rounded-2xl border border-border bg-card p-4" />
        </div>
      </Fold>

      <form action={signOut}>
        <button type="submit" data-cabinet-logout className="press flex min-h-14 w-full items-center gap-3 rounded-2xl border border-border/70 bg-card px-4 py-3 text-left text-base font-semibold text-destructive shadow-sm hover:bg-destructive-soft/50">
          <LogOut className="size-6 shrink-0" aria-hidden />
          <span className="flex-1">{t("easy.cabinet.links.logout")}</span>
        </button>
      </form>
    </div>
  );
}

/**
 * "Universal ustalar" (santexnik, elektrik…) — telefonda bosh sahifa chati juda sodda bo'lgani uchun shu yerda (ega,
 * 2026-11-21: "Profil ichiga"); mehmonga ham ko'rinadi
 */
function MastersRow({ t }: { t: TFunction }) {
  return (
    <Link href="/ustalar" data-cabinet-masters className="press flex min-h-16 items-center gap-3 rounded-2xl border border-border/70 bg-card px-4 py-3 shadow-sm hover:bg-secondary/60">
      <Wrench className="size-6 shrink-0 text-primary-ink" aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block text-base font-semibold">{t("masters.name")}</span>
        <span className="block text-sm text-muted-foreground">{t("easy.side.menu.masters_hint")}</span>
      </span>
      <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
    </Link>
  );
}
