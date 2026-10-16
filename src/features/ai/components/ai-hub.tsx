import Form from "next/form";
import Link from "next/link";
import { BellRing, ChevronRight, PenLine, Search, Sparkles, type LucideIcon } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { aiProviderConfigured } from "@/lib/ai/json";
import type { SessionContext } from "@/features/auth/session";
import type { AppMode } from "@/features/mode/mode";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * /ai — AI bo'limi (pastki menyudagi "AI"): bitta joyda —
 *  1) oddiy so'z bilan qidiruv (lug'at + sozlangan bo'lsa AI tushunadi; natijalar — bazadagi haqiqiy e'lonlar);
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
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight sm:text-3xl">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground" aria-hidden>
            <Sparkles className="size-5" />
          </span>
          {t("easy.aihub.title")}
        </h1>
        <p className="mt-2 text-base text-muted-foreground">{t("easy.aihub.subtitle")}</p>
      </div>

      <section aria-labelledby="ai-search" className="space-y-3 rounded-2xl border border-primary/20 bg-primary-soft p-4 sm:p-5">
        <h2 id="ai-search" className="text-lg font-bold">
          {t("easy.aihub.search_title")}
        </h2>
        <p className="text-sm text-muted-foreground">{employer ? t("easy.aihub.search_desc_workers") : t("easy.aihub.search_desc_jobs")}</p>
        <Form action="/search" prefetch={false} role="search" aria-label={t("easy.aihub.search_label")} className="flex gap-2">
          <input type="hidden" name="mode" value={employer ? "workers" : "jobs"} />
          <div className="min-w-0 flex-1">
            <Input
              name="q"
              type="search"
              enterKeyHint="search"
              aria-label={t("easy.aihub.search_label")}
              placeholder={t("easy.aihub.search_label")}
              leftIcon={<Search />}
              className="h-12 rounded-xl bg-card"
              maxLength={120}
              minLength={2}
              required
            />
          </div>
          <Button type="submit" className="h-12 shrink-0 px-5 text-base font-bold">
            {t("easy.aihub.search_button")}
          </Button>
        </Form>
      </section>

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
