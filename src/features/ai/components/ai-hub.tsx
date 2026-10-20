import Link from "next/link";
import { BellRing, ChevronRight, PenLine, Sparkles, type LucideIcon } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { aiProviderConfigured } from "@/lib/ai/json";
import type { SessionContext } from "@/features/auth/session";
import type { AppMode } from "@/features/mode/mode";
import { AiAvatar } from "@/components/shared/ai-avatar";
import { AiChatPanel } from "@/features/find/components/ai-chat";

/**
 * /ai — AI yordamchi sahifasi: bitta joyda —
 *  1) suhbat (yozish yoki ovoz): lug'at + sozlangan bo'lsa AI tushunadi; natijalar — bazadagi haqiqiy e'lonlar, shu sahifada;
 *  2) "Sizga mos" — moslik dvigateli hisoblagan e'lonlar/nomzodlar va sabablari (/cabinet/matches);
 *  3) AI PRO kuzatuv (/ai-alerts); 4) AI bilan e'lon tuzish — faqat AI provayder sozlangan bo'lsa.
 * Hisoblanmagan foiz yoki soxta va'da yo'q.
 */
export async function AiHub({ session, mode }: { session: SessionContext | null; mode: AppMode | null }) {
  const { t } = await getT();
  const employer = mode === "employer";
  const matchesHref = !session
    ? "/auth?next=%2Fcabinet%2Fmatches"
    : employer
      ? session.employerOnboarded
        ? "/cabinet/matches"
        : "/post/vacancy"
      : session.workerId
        ? "/cabinet/matches"
        : "/post/worker";
  const matchesSub = !session ? t("easy.aihub.matches_login") : !employer && !session.workerId ? t("easy.aihub.matches_profile") : employer ? t("easy.aihub.candidates_desc") : t("easy.aihub.matches_desc");
  const cards: { key: string; href: string; icon: LucideIcon; title: string; desc: string }[] = [
    { key: "matches", href: matchesHref, icon: Sparkles, title: employer ? t("easy.aihub.candidates_title") : t("easy.aihub.matches_title"), desc: matchesSub },
    { key: "pro", href: "/ai-alerts", icon: BellRing, title: t("easy.aihub.pro_title"), desc: t("easy.aihub.pro_desc") },
    ...(aiProviderConfigured()
      ? [
          employer
            ? { key: "fill", href: "/post/vacancy", icon: PenLine, title: t("easy.aihub.fill_title_employer"), desc: t("easy.aihub.fill_desc_employer") }
            : { key: "fill", href: "/post/worker", icon: PenLine, title: t("easy.aihub.fill_title_worker"), desc: t("easy.aihub.fill_desc_worker") },
        ]
      : []),
  ];

  return (
    <div className="container-narrow space-y-6 py-5 sm:py-8">
      <div className="flex items-start gap-3">
        <AiAvatar size="lg" />
        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{t("easy.aihub.title")}</h1>
          <p className="mt-1 text-base text-muted-foreground">{t("easy.aihub.subtitle")}</p>
        </div>
      </div>

      {/* suhbat shu sahifaning o'zida: yozing yoki ayting — natija (bazadagi haqiqiy e'lonlar) shu yerda, aniqlashtirish bilan */}
      <AiChatPanel
        defaultMode={employer ? "workers" : "jobs"}
        locked={mode !== null}
        examples={{
          jobs: [t("easy.finder.example_j1"), t("easy.finder.example_j2"), t("easy.finder.example_j3")],
          workers: [t("easy.finder.example_w1"), t("easy.finder.example_w2"), t("easy.finder.example_w3")],
        }}
      />

      <h2 className="text-lg font-bold">{t("easy.aihub.more_title")}</h2>
      <ul className="grid gap-3 sm:grid-cols-2">
        {cards.map((c) => (
          <li key={c.key} className="flex">
            <Link href={c.href} data-track="ai_hub" data-track-to={c.key} className="press flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-4 hover:border-primary/50">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary" aria-hidden>
                <c.icon className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-bold leading-snug">{c.title}</span>
                <span className="mt-0.5 block text-sm leading-snug text-muted-foreground">{c.desc}</span>
              </span>
              <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>

      <p className="text-sm text-muted-foreground">{t("easy.aihub.note")}</p>
    </div>
  );
}
