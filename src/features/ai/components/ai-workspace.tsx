import { getT } from "@/lib/i18n/server";
import { aiProviderConfigured } from "@/lib/ai/json";
import type { SessionContext } from "@/features/auth/session";
import type { AppMode } from "@/features/mode/mode";
import { getWorkspaceData } from "../workspace-data";
import {
  AiWorkspaceClient,
  type QuickAction,
  type WorkspaceUser,
} from "./ai-workspace-client";

/**
 * /ai — "Yordamchi" (avval "AI yordamchi" / "Barchasi siz uchun"), alohida to'liq ekran (2026-11-15, ega: "tagida menyular
 * ko'rinmasin — alohida katta ekranga kirsin"): o'z sarlavhasi ("‹" — ilovaga qaytish), salomlashuv, "Bugungi ishlar" (faqat
 * bazadagi haqiqiy raqamlar), "Sizga mos ishlar", tezkor imkoniyatlar (ish qidirish — so'rovnoma oynasi; CV, xabarlar).
 * Kompyuterda chapda suhbatlar, o'ngda tezkor imkoniyatlar va maslahat; telefonda suhbatlar pastdan chiqadi.
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
  // 2026-11-16 (ega: "AI uzun matn yozmasin"): faqat qidiruv (so'rovnoma oynasi) va sahifalarga havolalar — erkin suhbat
  // (karyera maslahati, suhbatga tayyorgarlik, vakansiya matni) olib tashlandi
  const quick: QuickAction[] = employer
    ? [
        { key: "candidates", label: t("easy.aiws.quick.candidates"), icon: "workers", prompt: t("easy.aiws.quick.candidates") },
        { key: "post", label: t("easy.aiws.quick.post"), icon: "post", href: session?.employerOnboarded ? "/employer/vacancies/new" : "/post/vacancy" },
        { key: "alerts", label: t("easy.aihub.pro_title"), icon: "alerts", href: "/ai-alerts?role=employer" },
      ]
    : [
        { key: "find", label: t("easy.aiws.quick.find"), icon: "jobs", prompt: t("easy.aiws.quick.find") },
        { key: "cv", label: t("easy.aiws.quick.cv"), icon: "cv", href: session?.workerId ? "/profile/cv" : "/post/worker" },
        { key: "alerts", label: t("easy.aihub.pro_title"), icon: "alerts", href: "/ai-alerts" },
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
      quick={quick}
      tips={tips}
      data={data}
      aiConfigured={aiProviderConfigured()}
      initialQuery={query}
      defaultMode={employer ? "workers" : "jobs"}
    />
  );
}
