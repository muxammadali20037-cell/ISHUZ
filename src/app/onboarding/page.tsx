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
          <p className="mt-1.5 text-md text-muted-foreground">{t("auth.choose_role_subtitle")}</p>
        </div>

        {/* ikki teng tanlov — bir xil neytral kartalar (biri to'liq ko'k bo'lmaydi); "ikkala rejim" izohi sarlavha ostida bir marta */}
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {(
            [
              { href: "/onboarding/worker", icon: UserRound, title: t("onboarding.role.worker_title"), desc: t("onboarding.role.worker_desc"), cta: t("onboarding.role.worker_cta") },
              { href: "/onboarding/employer", icon: Building2, title: t("onboarding.role.employer_title"), desc: t("onboarding.role.employer_desc"), cta: t("onboarding.role.employer_cta") },
            ] as const
          ).map((c) => (
            <Link key={c.href} href={c.href} className="press group flex flex-col rounded-2xl border border-border bg-card p-6 shadow-sm hover:border-primary/50 active:scale-[0.98] sm:p-7">
              <span className="flex size-12 items-center justify-center rounded-xl bg-primary-soft text-primary" aria-hidden>
                <c.icon className="size-7" />
              </span>
              <span className="mt-5 text-xl font-bold sm:text-2xl">{c.title}</span>
              <span className="mt-1 flex-1 text-base text-muted-foreground">{c.desc}</span>
              <span className="mt-6 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-5 font-semibold text-primary-foreground group-hover:bg-primary-hover">
                {c.cta} <ArrowRight className="size-5" aria-hidden />
              </span>
            </Link>
          ))}
        </div>
      </div>
    </Shell>
  );
}
