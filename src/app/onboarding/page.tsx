import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Building2, UserRound } from "lucide-react";
import { requireSession } from "@/features/auth/session";
import { getT } from "@/lib/i18n/server";
import { Shell } from "@/components/shared/shell";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("auth.choose_role_title"), robots: { index: false } };
}

/**
 * Rol tanlash: ish qidiruvchi yoki ish beruvchi.
 * Profil allaqachon bor bo'lsa — tegishli joyga yo'naltiradi.
 */
export default async function OnboardingPage() {
  const session = await requireSession("/onboarding");
  if (session.workerId && !session.workerOnboarded) redirect("/onboarding/worker");
  if (session.workerOnboarded) redirect("/");
  if (session.employerId) redirect(session.employerOnboarded ? "/employer" : "/onboarding/employer");

  const { t } = await getT();
  const firstName = session.profile.first_name.trim();

  return (
    <Shell hideNav>
      <div className="container-narrow py-8 sm:py-14">
        <div className="text-center sm:text-left">
          <p className="text-sm font-semibold text-primary">{firstName ? t("onboarding.role.greeting", { name: firstName }) : t("auth.welcome_title")}</p>
          <h1 className="mt-1 text-2xl font-bold sm:text-3xl">{t("auth.choose_role_title")}</h1>
          <p className="mt-1.5 text-[15px] text-muted-foreground">{t("auth.choose_role_subtitle")}</p>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <Link
            href="/onboarding/worker"
            className="group flex flex-col rounded-3xl bg-primary p-6 text-primary-foreground shadow-md transition-transform hover:-translate-y-0.5 sm:p-7"
          >
            <span className="flex size-14 items-center justify-center rounded-2xl bg-white/15">
              <UserRound className="size-7" />
            </span>
            <span className="mt-5 text-xl font-bold sm:text-2xl">{t("onboarding.role.worker_title")}</span>
            <span className="mt-1 text-sm text-primary-foreground/80">{t("onboarding.role.worker_desc")}</span>
            <span className="mt-6 inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-white px-5 font-semibold text-primary">
              {t("onboarding.role.worker_cta")} <ArrowRight className="size-5 transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>
          <Link
            href="/onboarding/employer"
            className="group flex flex-col rounded-3xl border border-border bg-card p-6 shadow-sm transition-transform hover:-translate-y-0.5 sm:p-7"
          >
            <span className="flex size-14 items-center justify-center rounded-2xl bg-primary-soft text-primary">
              <Building2 className="size-7" />
            </span>
            <span className="mt-5 text-xl font-bold sm:text-2xl">{t("onboarding.role.employer_title")}</span>
            <span className="mt-1 text-sm text-muted-foreground">{t("onboarding.role.employer_desc")}</span>
            <span className="mt-6 inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-primary px-5 font-semibold text-primary-foreground">
              {t("onboarding.role.employer_cta")} <ArrowRight className="size-5 transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">{t("onboarding.role.note")}</p>
      </div>
    </Shell>
  );
}
