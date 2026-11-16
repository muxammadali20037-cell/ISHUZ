"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowRight,
  BarChart3,
  BellRing,
  Bookmark,
  BriefcaseBusiness,
  Building2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Compass,
  FileCheck2,
  FileUser,
  GraduationCap,
  History,
  Home,
  Lightbulb,
  ListTodo,
  LogIn,
  MessageSquareText,
  MoreHorizontal,
  PenLine,
  Plus,
  Sparkles,
  Target,
  Trash2,
  UserRound,
  UsersRound,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { Fold } from "@/components/shared/fold";
import { BackLink } from "@/components/shared/back-link";
import { TINT_TILE, tintAt } from "@/components/shared/tints";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, Sheet } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AiAvatar } from "@/components/shared/ai-avatar";
import {
  AiPromptBox,
  AiThread,
  useAiChat,
  type AiChatState,
} from "@/features/find/components/ai-chat";
import {
  JobResultCard,
  WorkerResultCard,
} from "@/features/find/components/result-cards";
import type { FinderMode } from "@/features/find/ai-chat-model";
import type { BriefIcon, WorkspaceData } from "../workspace-data";

export type IconKey =
  | "home"
  | "ai"
  | "jobs"
  | "matches"
  | "applications"
  | "saved"
  | "cv"
  | "careers"
  | "workers"
  | "vacancies"
  | "company"
  | "post"
  | "text"
  | "interview"
  | "login"
  | "profile"
  | "profession"
  | "alerts"
  | "stats";

const ICONS: Record<IconKey | BriefIcon, LucideIcon> = {
  home: Home,
  ai: Sparkles,
  jobs: BriefcaseBusiness,
  matches: Target,
  applications: FileCheck2,
  saved: Bookmark,
  cv: FileUser,
  careers: GraduationCap,
  workers: UsersRound,
  candidates: UsersRound,
  vacancies: ClipboardList,
  company: Building2,
  post: Plus,
  text: PenLine,
  interview: MessageSquareText,
  login: LogIn,
  profile: UserRound,
  profession: Compass,
  alerts: BellRing,
  stats: BarChart3,
};

export interface QuickAction {
  key: string;
  label: string;
  icon: IconKey;
  /** sahifaga o'tish */
  href?: string;
  /** suhbatda shu savol yuboriladi */
  prompt?: string;
}

export interface WorkspaceUser {
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  roleLabel: string;
  href: string;
}

interface Props {
  role: "guest" | "worker" | "employer";
  locale: string;
  user: WorkspaceUser | null;
  quick: QuickAction[];
  tips: string[];
  data: WorkspaceData;
  aiConfigured: boolean;
  initialQuery?: string;
  defaultMode: FinderMode;
}

/** /ai "Yordamchi" (mijoz tomoni): o'z sarlavhasi · suhbatlar · suhbat · o'ng panel; telefonda suhbatlar pastdan chiqadi */
export function AiWorkspaceClient(props: Props) {
  const { t } = useT();
  const chat = useAiChat(props.defaultMode);
  const { ready, ask } = chat;
  const [drawer, setDrawer] = useState(false);
  const asked = useRef(false);

  // /ai?q=… — bosh sahifadagi maydondan kelgan savol: bir marta, o'zi yuboriladi (manzildan olib tashlanadi)
  useEffect(() => {
    if (!ready || asked.current || !props.initialQuery) return;
    asked.current = true;
    window.history.replaceState(null, "", window.location.pathname);
    ask(props.initialQuery);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `ask` har chizishda yangi; savol faqat bir marta yuboriladi (asked)
  }, [ready, props.initialQuery]);

  // tezkor tugma ("Ish qidirish", "Nomzod topish"): so'rovnoma oynasi bo'sh "Qanday ish?" bilan ochiladi
  const run = (label: string) => {
    setDrawer(false);
    chat.ask(label, { blank: true });
    document.getElementById("ai-ws-text")?.focus();
  };

  // "Suhbatlar": yangi suhbat, so'nggi suhbatlar va profil (kompyuterda chap ustun, telefonda pastdan chiqadi).
  // Sayt bo'limlari bu yerda yo'q — "Yordamchi" alohida ekran, ilovaga "‹" bilan qaytiladi (ega, 2026-11-15)
  const sidebar = (
    <Sidebar
      user={props.user}
      chat={chat}
      onNew={() => {
        chat.clear();
        setDrawer(false);
      }}
      onOpen={(id) => {
        chat.openConversation(id);
        setDrawer(false);
      }}
    />
  );

  return (
    <div className="flex min-h-dvh flex-col bg-background" data-ai-workspace data-role={props.role}>
      <ChatHeader chat={chat} aiConfigured={props.aiConfigured} onHistory={() => setDrawer(true)} />

      {/* ChatGPT kabi: kompyuterda uch ustun (suhbatlar · suhbat · tezkor imkoniyatlar), telefonda — faqat suhbat, butun ekran */}
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col lg:grid lg:grid-cols-[248px_minmax(0,1fr)_288px] lg:items-start lg:gap-5 lg:px-6 lg:py-5 xl:grid-cols-[260px_minmax(0,1fr)_300px] 2xl:max-w-none 3xl:grid-cols-[300px_minmax(0,1fr)_340px] 3xl:gap-6">
        <aside className="hidden lg:sticky lg:top-24 lg:block" aria-label={t("easy.aiws.sidebar")} data-ai-sidebar>
          {sidebar}
        </aside>

        <section
          className="flex min-w-0 flex-1 flex-col lg:min-h-[calc(100dvh-7rem)] lg:rounded-2xl lg:border lg:border-border lg:bg-card lg:shadow-sm"
          aria-label={t("easy.aiws.title")}
          data-ai-chat-panel
        >
          {/* xabarlar ustuni juda keng bo'lib ketmaydi (o'qish qulay) — panel esa butun joyni egallaydi */}
          <div className={cn("w-full flex-1 space-y-5 px-4 py-4 sm:px-6 2xl:mx-auto 2xl:max-w-5xl", !chat.turns.length && "lg:flex lg:flex-col lg:justify-center")}>
            {chat.turns.length ? (
              <AiThread chat={chat} examples={[]} scrollOnRestore={false} bar={false} />
            ) : (
              <Welcome {...props} chat={chat} onPrompt={run} />
            )}
          </div>

          {/* yozish maydoni — ekran tagida (pastki menyu yo'q), tizim chizig'i ustida */}
          <div
            className="sticky bottom-0 z-10 border-t border-border bg-card px-3 pt-3 sm:px-4 lg:rounded-b-2xl"
            style={{ paddingBottom: "calc(0.375rem + var(--safe-bottom))" }}
          >
            <div className="2xl:mx-auto 2xl:max-w-5xl">
              <AiPromptBox chat={chat} id="ai-ws-text" />
            </div>
          </div>
        </section>

        <aside className="hidden lg:sticky lg:top-24 lg:block" data-ai-rail>
          <RightRail quick={props.quick} tips={props.tips} chat={chat} onPrompt={run} />
        </aside>
      </div>

      <Dialog open={drawer} onOpenChange={setDrawer}>
        <Sheet title={t("easy.aiws.sidebar")} className="sm:max-w-sm" data-ai-drawer>
          {sidebar}
        </Sheet>
      </Dialog>
    </div>
  );
}

/* ----------------------------------------------------------------------------------------------- chap panel */

function Sidebar({
  user,
  chat,
  onNew,
  onOpen,
}: {
  user: WorkspaceUser | null;
  chat: AiChatState;
  onNew: () => void;
  onOpen: (id: number) => void;
}) {
  const { t } = useT();
  return (
    <div className="flex flex-col gap-5">
      <Button
        type="button"
        size="lg"
        fullWidth
        onClick={onNew}
        disabled={chat.pending}
        className="text-base"
        data-ai-new-chat
      >
        <Plus className="size-5" aria-hidden /> {t("easy.aiws.new_chat")}
      </Button>

      <section
        aria-labelledby="ai-recent"
        className="border-t border-border pt-4"
        data-ai-recent
      >
        <h2
          id="ai-recent"
          className="px-3 text-sm font-bold text-muted-foreground"
        >
          {t("easy.aiws.recent")}
        </h2>
        {chat.conversations.length ? (
          <ul className="mt-2 space-y-0.5">
            {chat.conversations.map((c) => {
              const current = c.id === chat.convId;
              const title = c.title || t("easy.aiws.new_chat");
              return (
                <li key={c.id} className="group flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onOpen(c.id)}
                    disabled={chat.pending}
                    aria-current={current ? "true" : undefined}
                    className={cn(
                      "press flex min-h-11 min-w-0 flex-1 items-center gap-2.5 rounded-xl px-3 text-left text-sm font-semibold",
                      current
                        ? "bg-primary-soft text-primary-ink"
                        : "text-foreground hover:bg-secondary",
                    )}
                  >
                    <MessageSquareText
                      className="size-4 shrink-0 text-muted-foreground"
                      aria-hidden
                    />
                    <span className="truncate">{title}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => chat.deleteConversation(c.id)}
                    disabled={chat.pending}
                    aria-label={t("easy.aiws.delete_chat", { title })}
                    className="press flex size-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-destructive lg:opacity-0 lg:focus-visible:opacity-100 lg:group-hover:opacity-100"
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-2 px-3 text-sm text-muted-foreground">
            {t("easy.aiws.recent_empty")}
          </p>
        )}
        <p className="mt-2 px-3 text-xs text-muted-foreground">
          {t("easy.aiws.recent_note")}
        </p>
      </section>

      <div className="border-t border-border pt-4" data-ai-user>
        {user ? (
          <Link
            href={user.href}
            className="press flex min-h-14 items-center gap-3 rounded-xl px-2 hover:bg-secondary"
          >
            <Avatar
              src={user.avatarUrl}
              fallback={initials(user.firstName, user.lastName) || "?"}
              alt=""
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-bold">
                {[user.firstName, user.lastName].filter(Boolean).join(" ")}
              </span>
              <span className="block text-sm text-muted-foreground">
                {user.roleLabel}
              </span>
            </span>
            <ArrowRight
              className="size-5 shrink-0 text-muted-foreground"
              aria-hidden
            />
          </Link>
        ) : (
          <Link
            href="/auth?next=%2Fai"
            className="press flex min-h-14 items-center gap-3 rounded-xl px-2 hover:bg-secondary"
          >
            <span
              className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-ink"
              aria-hidden
            >
              <UserRound className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-bold">{t("easy.aiws.guest")}</span>
              <span className="block text-sm text-primary-ink">
                {t("easy.aiws.guest_login")}
              </span>
            </span>
            <LogIn
              className="size-5 shrink-0 text-muted-foreground"
              aria-hidden
            />
          </Link>
        )}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------------------------------------- suhbat sarlavhasi */

function ChatHeader({
  chat,
  aiConfigured,
  onHistory,
}: {
  chat: AiChatState;
  aiConfigured: boolean;
  /** telefonda "Suhbatlar" panelini ochadi */
  onHistory: () => void;
}) {
  const { t } = useT();
  const last = chat.turns.at(-1);
  const status = chat.pending
    ? last?.stage === "searching"
      ? t("easy.aiws.status_search")
      : t("easy.aiws.status_busy")
    : aiConfigured
      ? t("easy.aiws.status_ai")
      : t("easy.aiws.status_rules");
  return (
    // alohida ekranning o'z sarlavhasi: "‹" (ilovaga qaytish) · Yordamchi · suhbatlar · menyu
    <header className="sticky top-0 z-20 border-b border-border bg-card" style={{ paddingTop: "var(--safe-top)" }} data-ai-header>
    <div className="mx-auto flex min-h-16 w-full max-w-6xl items-center gap-1 px-2 py-2 sm:gap-3 sm:px-4 lg:px-6 2xl:max-w-none">
      <BackLink
        fallback="/"
        label={t("easy.wizard.back")}
        className="press flex size-11 shrink-0 items-center justify-center rounded-xl text-foreground hover:bg-secondary"
      >
        <ChevronLeft className="size-6" aria-hidden />
      </BackLink>
      {/* telefonda belgi yo'q — joy "Suhbatlar" va menyu tugmalariga (salomlashuvda belgi bor) */}
      <AiAvatar busy={chat.pending} size="md" className="max-sm:hidden" />
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-lg font-extrabold leading-tight">
          {t("easy.aiws.title")}
        </h1>
        <p
          className="flex items-center gap-1.5 text-sm text-muted-foreground"
          data-ai-header-status
          aria-live="polite"
        >
          <span
            className={cn(
              "size-2 shrink-0 rounded-full",
              chat.pending
                ? "bg-primary animate-pulse"
                : aiConfigured
                  ? "bg-success"
                  : "bg-muted-foreground",
            )}
            aria-hidden
          />
          <span className="truncate">{status}</span>
        </p>
      </div>
      {/* telefonda suhbat ketayotganda — "Yangi suhbat" bir bosishda (kompyuterda chap ustunda bor) */}
      {chat.turns.length ? (
        <button
          type="button"
          onClick={chat.clear}
          disabled={chat.pending}
          aria-label={t("easy.aiws.new_chat")}
          className="press flex size-11 shrink-0 items-center justify-center rounded-xl text-primary-ink hover:bg-secondary disabled:opacity-40 lg:hidden"
          data-ai-new-chat-top
        >
          <Plus className="size-5" aria-hidden />
        </button>
      ) : null}
      <button
        type="button"
        onClick={onHistory}
        aria-label={t("easy.aiws.open_sidebar")}
        className="press flex size-11 shrink-0 items-center justify-center rounded-xl text-muted-foreground hover:bg-secondary lg:hidden"
        data-ai-open-sidebar
      >
        <History className="size-5" aria-hidden />
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={t("easy.aiws.menu")}
            className="press flex size-11 items-center justify-center rounded-xl text-muted-foreground hover:bg-secondary"
            data-ai-menu
          >
            <MoreHorizontal className="size-5" aria-hidden />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={chat.clear} disabled={chat.pending}>
            <Plus className="size-4" aria-hidden /> {t("easy.aiws.menu_new")}
          </DropdownMenuItem>
          {chat.convId ? (
            <DropdownMenuItem
              onSelect={() => chat.deleteConversation(chat.convId!)}
              disabled={chat.pending}
            >
              <Trash2 className="size-4" aria-hidden />{" "}
              {t("easy.aiws.menu_delete")}
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
    </header>
  );
}

/* ----------------------------------------------------------------------------------------------- salomlashuv */

function Welcome({
  role,
  user,
  data,
  quick,
  chat,
  onPrompt,
}: Props & { chat: AiChatState; onPrompt: (p: string) => void }) {
  const { t } = useT();
  const greeting = user?.firstName
    ? t("easy.aiws.greeting_name", { name: user.firstName })
    : t("easy.aiws.greeting");
  const intro =
    role === "guest"
      ? t("easy.aiws.greeting_intro_guest")
      : role === "employer" && !data.items.length
        ? t("easy.aiws.greeting_intro_employer")
        : data.items.length
          ? t("easy.aiws.greeting_intro")
          : t("easy.aiws.greeting_intro_guest");
  const feed = data.feed;
  return (
    <div className="ai-bubble-in space-y-4" data-ai-welcome>
      <div className="flex items-start gap-3">
        <AiAvatar size="sm" className="mt-1" />
        <div className="rounded-2xl rounded-tl-md bg-secondary px-4 py-3 text-base leading-relaxed">
          <p className="font-bold">{greeting}</p>
          <p>{intro}</p>
        </div>
      </div>

      {/* "Bugungi ishlar" va "Yangi ishlar" — yig'ilgan (ega, 2026-11-15: "ichiga yashir — «ochish», «ko'rish» so'zlari bilan") */}
      {data.items.length ? (
        <Fold name="ai-brief" icon={<ListTodo />} tint="violet" verb="open" title={t("easy.aiws.brief_title")} count={data.items.length}>
          <section aria-label={t("easy.aiws.brief_title")} data-ai-brief>
            <ul className="space-y-2">
              {data.items.map((item) => {
                const Icon = ICONS[item.icon];
                return (
                  <li key={item.key} className="flex items-center gap-3">
                    <span
                      className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-ink"
                      aria-hidden
                    >
                      <Icon className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1 text-base leading-snug">
                      {item.text}
                    </span>
                    <Link
                      href={item.href}
                      className="press inline-flex min-h-11 shrink-0 items-center gap-1 rounded-full border border-primary/30 bg-card px-3 text-sm font-semibold text-primary-ink hover:bg-primary-soft"
                    >
                      {item.cta} <ArrowRight className="size-4" aria-hidden />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        </Fold>
      ) : null}

      {feed && feed.items.length ? (
        <Fold name="ai-feed" icon={<Target />} tint="green" verb="view" tone="soft" title={feed.title} count={feed.total}>
          <section aria-label={feed.title} data-ai-feed>
            <div className="flex items-baseline justify-between gap-3">
              <p className="min-w-0 text-sm text-muted-foreground">
                {feed.subtitle}
              </p>
              <Link
                href={feed.href}
                className="-my-2 inline-flex min-h-11 shrink-0 items-center gap-0.5 text-sm font-semibold text-primary-ink hover:underline"
              >
                {t("easy.aiws.feed.see_all", { count: feed.total })}{" "}
                <ChevronRight className="size-4" aria-hidden />
              </Link>
            </div>
            <ul className="-mx-4 mt-3 flex snap-x gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:thin]">
              {feed.kind === "jobs"
                ? feed.items.map((job) => (
                    <li
                      key={job.id}
                      className="flex w-[280px] shrink-0 snap-start sm:w-[300px] [&>article]:w-full"
                    >
                      <JobResultCard
                        job={job}
                        saved={feed.saved.includes(job.id)}
                        applied={feed.applied[job.id] ?? null}
                      />
                    </li>
                  ))
                : feed.items.map((w) => (
                    <li
                      key={w.id}
                      className="flex w-[280px] shrink-0 snap-start sm:w-[300px] [&>article]:w-full"
                    >
                      <WorkerResultCard
                        worker={w}
                        imageUrl={
                          w.profession_node_id
                            ? feed.images[w.profession_node_id]
                            : null
                        }
                        saved={feed.saved.includes(w.id)}
                      />
                    </li>
                  ))}
            </ul>
          </section>
        </Fold>
      ) : null}

      {/* telefon va planshet: tezkor imkoniyatlar (o'ng panel yo'q). "Masalan, bosing" yo'q — ega, 2026-11-15: "kerakmas" */}
      <div className="lg:hidden">
        <QuickActions quick={quick} onPrompt={onPrompt} chat={chat} compact />
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------------------------------------- o'ng panel */

function QuickActions({
  quick,
  onPrompt,
  chat,
  compact = false,
}: {
  quick: QuickAction[];
  onPrompt: (p: string) => void;
  chat: AiChatState;
  compact?: boolean;
}) {
  const { t } = useT();
  const item =
    "press flex min-h-11 w-full items-center gap-3 rounded-xl px-2 text-left text-base font-semibold hover:bg-secondary disabled:opacity-50";
  // telefonda: ikki ustunli oq plitkalar (bosh sahifadagi tezkor yo'llar kabi) — hammasi ko'rinadi, yonga surilmaydi
  const tile =
    "press flex min-h-14 w-full min-w-0 items-center gap-2.5 rounded-xl border border-border/70 bg-card px-2.5 py-2 text-left text-sm font-semibold leading-tight shadow-sm hover:border-primary/50 disabled:opacity-50";
  return (
    <section
      aria-labelledby={compact ? "ai-quick-m" : "ai-quick"}
      className={cn(!compact && "rounded-2xl border border-border bg-card p-4")}
      data-ai-quick
    >
      <h2
        id={compact ? "ai-quick-m" : "ai-quick"}
        className="flex items-center gap-2 text-base font-bold"
      >
        <Zap className="size-5 text-warning" aria-hidden />{" "}
        {t("easy.aiws.quick_title")}
      </h2>
      <ul className={cn("mt-2", compact ? "grid grid-cols-2 gap-2" : "space-y-0.5")}>
        {quick.map((q, i) => {
          const Icon = ICONS[q.icon];
          const inner: ReactNode = (
            <>
              <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", TINT_TILE[tintAt(i)])} aria-hidden>
                <Icon className={compact ? "size-5" : "size-4"} />
              </span>
              <span className={cn("min-w-0 flex-1", compact ? "[overflow-wrap:anywhere]" : "truncate")}>{q.label}</span>
              {!compact ? (
                <ChevronRight
                  className="size-4 shrink-0 text-muted-foreground"
                  aria-hidden
                />
              ) : null}
            </>
          );
          return (
            <li key={q.key} className="flex min-w-0">
              {q.href ? (
                <Link
                  href={q.href}
                  className={compact ? tile : item}
                  data-quick={q.key}
                >
                  {inner}
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => onPrompt(q.label)}
                  disabled={chat.pending}
                  className={compact ? tile : item}
                  data-quick={q.key}
                >
                  {inner}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function RightRail({
  quick,
  tips,
  chat,
  onPrompt,
}: {
  quick: QuickAction[];
  tips: string[];
  chat: AiChatState;
  onPrompt: (p: string) => void;
}) {
  const { t } = useT();
  // kun bo'yicha almashadigan maslahat (bir xil kunda hamma bir xil maslahatni ko'radi); o'qlar bilan qolganlari
  const [tip, setTip] = useState(() =>
    tips.length ? Math.floor(Date.now() / 86_400_000) % tips.length : 0,
  );
  return (
    <div className="space-y-4">
      <QuickActions quick={quick} onPrompt={onPrompt} chat={chat} />

      {tips.length ? (
        <section
          aria-labelledby="ai-tip"
          className="rounded-2xl border border-border bg-card p-4"
          data-ai-tip
        >
          <h2
            id="ai-tip"
            className="flex items-center gap-2 text-base font-bold"
          >
            <Lightbulb className="size-5 text-warning" aria-hidden />{" "}
            {t("easy.aiws.tip_title")}
          </h2>
          <p
            className="mt-2 text-base leading-relaxed text-muted-foreground"
            aria-live="polite"
          >
            {tips[tip]}
          </p>
          {tips.length > 1 ? (
            <div className="mt-2 flex items-center justify-between">
              <button
                type="button"
                onClick={() =>
                  setTip((i) => (i - 1 + tips.length) % tips.length)
                }
                aria-label={t("easy.aiws.tip_prev")}
                className="press flex size-11 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary"
              >
                <ChevronLeft className="size-4" aria-hidden />
              </button>
              <ol className="flex items-center gap-1.5" aria-hidden>
                {tips.map((_, i) => (
                  <li
                    key={i}
                    className={cn(
                      "size-1.5 rounded-full",
                      i === tip ? "bg-primary" : "bg-border",
                    )}
                  />
                ))}
              </ol>
              <button
                type="button"
                onClick={() => setTip((i) => (i + 1) % tips.length)}
                aria-label={t("easy.aiws.tip_next")}
                className="press flex size-11 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary"
              >
                <ChevronRight className="size-4" aria-hidden />
              </button>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
