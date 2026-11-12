import { getT } from "@/lib/i18n/server";
import { aiProviderConfigured } from "@/lib/ai/json";
import type { SessionContext } from "@/features/auth/session";
import type { AppMode } from "@/features/mode/mode";
import { getWorkspaceData } from "../workspace-data";
import {
  AiWorkspaceClient,
  type NavItem,
  type QuickAction,
  type WorkspaceUser,
} from "./ai-workspace-client";

/**
 * /ai — AI yordamchi ish maydoni (2026-11, "ChatGPT kabi"): chapda bo'limlar, so'nggi suhbatlar va profil; o'rtada suhbat —
 * salomlashuv, "Bugungi ishlar" (faqat bazadagi haqiqiy raqamlar), "Sizga mos ishlar" (bosh sahifa bilan bir manba), javoblar
 * jarayon izi bilan; o'ngda tezkor imkoniyatlar va maslahat. Telefonda — faqat suhbat, bo'limlar va suhbatlar pastdan chiqadi.
 * Havolalar faqat mavjud sahifalarga; mehmonga kirish talab qiladiganlari /auth?next= orqali.
 */
export async function AiWorkspace({
  session,
  mode,
  query,
}: {
  session: SessionContext | null;
  mode: AppMode | null;
  query?: string;
}) {
  const { t, name, locale } = await getT();
  const employer = mode === "employer";
  const role = !session ? "guest" : employer ? "employer" : "worker";
  const data = await getWorkspaceData(session, mode, t, name);
  const auth = (next: string) =>
    session ? next : `/auth?next=${encodeURIComponent(next)}`;

  const nav: NavItem[] = employer
    ? [
        {
          key: "home",
          href: "/",
          label: t("easy.aiws.nav.home"),
          icon: "home",
        },
        { key: "ai", href: "/ai", label: t("easy.aiws.nav.ai"), icon: "ai" },
        {
          key: "workers",
          href: auth("/workers"),
          label: t("easy.aiws.nav.workers"),
          icon: "workers",
        },
        {
          key: "candidates",
          href: auth("/cabinet/matches"),
          label: t("easy.aiws.nav.candidates"),
          icon: "matches",
        },
        {
          key: "applications",
          href: auth("/employer/applications"),
          label: t("easy.aiws.nav.emp_applications"),
          icon: "applications",
        },
        {
          key: "saved",
          href: auth("/employer/saved"),
          label: t("easy.aiws.nav.saved"),
          icon: "saved",
        },
        {
          key: "vacancies",
          href: auth("/employer/vacancies"),
          label: t("easy.aiws.nav.vacancies"),
          icon: "vacancies",
        },
        {
          key: "company",
          href: auth("/company/settings"),
          label: t("easy.aiws.nav.company"),
          icon: "company",
        },
      ]
    : [
        {
          key: "home",
          href: "/",
          label: t("easy.aiws.nav.home"),
          icon: "home",
        },
        { key: "ai", href: "/ai", label: t("easy.aiws.nav.ai"), icon: "ai" },
        {
          key: "jobs",
          href: "/jobs",
          label: t("easy.aiws.nav.jobs"),
          icon: "jobs",
        },
        {
          key: "matches",
          href: session?.workerId
            ? "/cabinet/matches"
            : session
              ? "/post/worker"
              : auth("/cabinet/matches"),
          label: t("easy.aiws.nav.matches"),
          icon: "matches",
        },
        {
          key: "applications",
          href: auth("/applications"),
          label: t("easy.aiws.nav.applications"),
          icon: "applications",
        },
        {
          key: "saved",
          href: "/saved",
          label: t("easy.aiws.nav.saved"),
          icon: "saved",
        },
        {
          key: "cv",
          href: session?.workerId
            ? "/profile/cv"
            : session
              ? "/post/worker"
              : auth("/profile/cv"),
          label: t("easy.aiws.nav.cv"),
          icon: "cv",
        },
        {
          key: "careers",
          href: "/kasblar",
          label: t("easy.aiws.nav.careers"),
          icon: "careers",
        },
      ];

  const quick: QuickAction[] = employer
    ? [
        {
          key: "post",
          label: t("easy.aiws.quick.post"),
          icon: "post",
          href: session?.employerOnboarded
            ? "/employer/vacancies/new"
            : "/post/vacancy",
        },
        {
          key: "candidates",
          label: t("easy.aiws.quick.candidates"),
          icon: "workers",
          prompt: t("easy.aiws.quick_prompt.candidates"),
        },
        {
          key: "vacancy_text",
          label: t("easy.aiws.quick.vacancy_text"),
          icon: "text",
          prompt: t("easy.aiws.quick_prompt.vacancy_text"),
        },
        {
          key: "questions",
          label: t("easy.aiws.quick.questions"),
          icon: "interview",
          prompt: t("easy.aiws.quick_prompt.questions"),
        },
        {
          key: "alerts",
          label: t("easy.aihub.pro_title"),
          icon: "alerts",
          href: "/ai-alerts?role=employer",
        },
      ]
    : [
        {
          key: "cv",
          label: t("easy.aiws.quick.cv"),
          icon: "cv",
          href: session?.workerId ? "/profile/cv" : "/post/worker",
        },
        {
          key: "find",
          label: t("easy.aiws.quick.find"),
          icon: "jobs",
          prompt: t("easy.aiws.quick_prompt.find"),
        },
        {
          key: "career",
          label: t("easy.aiws.quick.career"),
          icon: "careers",
          prompt: t("easy.aiws.quick_prompt.career"),
        },
        {
          key: "interview",
          label: t("easy.aiws.quick.interview"),
          icon: "interview",
          prompt: t("easy.aiws.quick_prompt.interview"),
        },
        {
          key: "alerts",
          label: t("easy.aihub.pro_title"),
          icon: "alerts",
          href: "/ai-alerts",
        },
      ];

  const user: WorkspaceUser | null = session
    ? {
        firstName: session.profile.first_name ?? "",
        lastName: session.profile.last_name ?? "",
        avatarUrl: session.profile.avatar_url ?? null,
        roleLabel: employer
          ? t("easy.aiws.role_employer")
          : t("easy.aiws.role_worker"),
        href: employer ? "/employer" : "/profile",
      }
    : null;

  const tips = (
    employer
      ? ["tip_1_employer", "tip_2_employer", "tip_3_employer"]
      : ["tip_1", "tip_2", "tip_3"]
  ).map((k) => t(`easy.aiws.${k}`));

  return (
    <AiWorkspaceClient
      role={role}
      locale={locale}
      user={user}
      nav={nav}
      quick={quick}
      promo={{
        title: employer
          ? t("easy.aiws.promo_title_employer")
          : t("easy.aiws.promo_title"),
        desc: employer
          ? t("easy.aiws.promo_desc_employer")
          : t("easy.aiws.promo_desc"),
        cta: t("easy.aiws.promo_cta"),
        prompt: employer
          ? t("easy.aiws.promo_prompt_employer")
          : t("easy.aiws.promo_prompt"),
      }}
      tips={tips}
      data={data}
      aiConfigured={aiProviderConfigured()}
      initialQuery={query}
      defaultMode={employer ? "workers" : "jobs"}
      examples={
        employer
          ? [
              t("easy.finder.example_w1"),
              t("easy.finder.example_w2"),
              t("easy.finder.example_w3"),
            ]
          : [
              t("easy.finder.example_j1"),
              t("easy.finder.example_j2"),
              t("easy.finder.example_j3"),
            ]
      }
    />
  );
}
