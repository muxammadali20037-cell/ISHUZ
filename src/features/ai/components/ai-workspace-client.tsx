"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
  Home,
  Lightbulb,
  ListTodo,
  LogIn,
  Menu,
  MessageSquareText,
  MoreHorizontal,
  PenLine,
  Plus,
  Sparkles,
  Target,
  Trash2,
  UserRound,
  UsersRound,
  Volume2,
  VolumeX,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { useT } from "@/lib/i18n/client";
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

export interface NavItem {
  key: string;
  href: string;
  label: string;
  icon: IconKey;
}

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
  nav: NavItem[];
  quick: QuickAction[];
  promo: { title: string; desc: string; cta: string; prompt: string };
  tips: string[];
  data: WorkspaceData;
  aiConfigured: boolean;
  initialQuery?: string;
  defaultMode: FinderMode;
  examples: string[];
}

/** /ai ish maydoni (mijoz tomoni): chap panel · suhbat · o'ng panel; telefonda chap panel pastdan chiqadi */
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

  const run = (prompt: string) => {
    setDrawer(false);
    chat.ask(prompt);
    document.getElementById("ai-ws-text")?.focus();
  };

  // kompyuterda kirgan foydalanuvchining bo'limlari sayt yon menyusida (to'q ko'k) bor — chap panelda takrorlanmaydi;
  // mehmonga (yon menyu yo'q) va telefon panelida — bo'limlar shu yerda
  const sidebar = (showNav: boolean) => (
    <Sidebar
      nav={showNav ? props.nav : []}
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
    <div
      className="container-app py-3 lg:py-5"
      data-ai-workspace
      data-role={props.role}
    >
      <div className="lg:grid lg:grid-cols-[248px_minmax(0,1fr)_288px] lg:items-start lg:gap-5 xl:grid-cols-[260px_minmax(0,1fr)_300px]">
        <aside
          className="hidden lg:sticky lg:top-20 lg:block"
          aria-label={t("easy.aiws.sidebar")}
          data-ai-sidebar
        >
          {sidebar(props.role === "guest")}
        </aside>

        <section
          className="min-w-0 rounded-2xl border border-border bg-card shadow-sm"
          aria-label={t("easy.aiws.title")}
        >
          {/* telefon va planshet: bo'limlar va suhbatlar — pastdan chiqadigan panel */}
          <div className="flex items-center justify-between gap-2 border-b border-border px-2 py-1.5 lg:hidden">
            <button
              type="button"
              onClick={() => setDrawer(true)}
              className="press inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-foreground hover:bg-secondary"
              aria-label={t("easy.aiws.open_sidebar")}
              data-ai-open-sidebar
            >
              <Menu className="size-5" aria-hidden />{" "}
              {t("easy.aiws.open_sidebar")}
            </button>
            <button
              type="button"
              onClick={chat.clear}
              disabled={chat.pending || !chat.turns.length}
              className="press inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-primary-ink hover:bg-secondary disabled:opacity-40"
            >
              <Plus className="size-5" aria-hidden /> {t("easy.aiws.new_chat")}
            </button>
          </div>

          <ChatHeader chat={chat} aiConfigured={props.aiConfigured} />

          <div className="space-y-5 px-3 py-4 sm:px-5">
            {chat.turns.length ? (
              <AiThread
                chat={chat}
                examples={props.examples}
                scrollOnRestore={false}
                bar={false}
              />
            ) : (
              <Welcome {...props} chat={chat} onPrompt={run} />
            )}
          </div>

          <div className="sticky bottom-[calc(var(--tabbar-height)+var(--safe-bottom))] z-10 rounded-b-2xl border-t border-border bg-card px-3 pb-1.5 pt-3 sm:px-4 md:bottom-0">
            <AiPromptBox chat={chat} id="ai-ws-text" />
          </div>
        </section>

        <aside className="hidden lg:sticky lg:top-20 lg:block" data-ai-rail>
          <RightRail
            quick={props.quick}
            promo={props.promo}
            tips={props.tips}
            chat={chat}
            onPrompt={run}
          />
        </aside>
      </div>

      <Dialog open={drawer} onOpenChange={setDrawer}>
        <Sheet
          title={t("easy.aiws.sidebar")}
          className="sm:max-w-sm"
          data-ai-drawer
        >
          {sidebar(true)}
        </Sheet>
      </Dialog>
    </div>
  );
}

/* ----------------------------------------------------------------------------------------------- chap panel */

function Sidebar({
  nav,
  user,
  chat,
  onNew,
  onOpen,
}: {
  nav: NavItem[];
  user: WorkspaceUser | null;
  chat: AiChatState;
  onNew: () => void;
  onOpen: (id: number) => void;
}) {
  const { t } = useT();
  const pathname = usePathname();
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

      {nav.length ? (
        <nav aria-label={t("easy.aiws.sidebar")}>
          <ul className="space-y-0.5">
            {nav.map((item) => {
              const Icon = ICONS[item.icon];
              const active = item.href === pathname;
              return (
                <li key={item.key}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "press flex min-h-11 items-center gap-3 rounded-xl px-3 text-base font-semibold",
                      active
                        ? "bg-primary-soft text-primary-ink"
                        : "text-foreground hover:bg-secondary",
                    )}
                  >
                    <Icon
                      className={cn(
                        "size-5 shrink-0",
                        active ? "text-primary-ink" : "text-muted-foreground",
                      )}
                      aria-hidden
                    />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      ) : null}

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
}: {
  chat: AiChatState;
  aiConfigured: boolean;
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
  const { speaker } = chat;
  return (
    <div className="flex items-center gap-3 border-b border-border px-3 py-3 sm:px-5">
      <AiAvatar busy={chat.pending} size="md" />
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
      {speaker.supported ? (
        <button
          type="button"
          role="switch"
          aria-checked={speaker.enabled}
          onClick={() => speaker.setEnabled(!speaker.enabled)}
          aria-label={t("easy.finder.voice_reply")}
          className={cn(
            "press flex size-11 items-center justify-center rounded-xl",
            speaker.enabled
              ? "bg-primary-soft text-primary-ink"
              : "text-muted-foreground hover:bg-secondary",
          )}
        >
          {speaker.enabled ? (
            <Volume2 className="size-5" aria-hidden />
          ) : (
            <VolumeX className="size-5" aria-hidden />
          )}
        </button>
      ) : null}
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
          {speaker.supported ? (
            <DropdownMenuItem
              onSelect={() => speaker.setEnabled(!speaker.enabled)}
            >
              {speaker.enabled ? (
                <Volume2 className="size-4" aria-hidden />
              ) : (
                <VolumeX className="size-4" aria-hidden />
              )}
              {speaker.enabled
                ? t("easy.aiws.menu_voice_on")
                : t("easy.aiws.menu_voice_off")}
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

/* ----------------------------------------------------------------------------------------------- salomlashuv */

function Welcome({
  role,
  user,
  data,
  quick,
  examples,
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

      {data.items.length ? (
        <section
          aria-labelledby="ai-brief"
          className="rounded-2xl border border-border bg-card p-4"
          data-ai-brief
        >
          <h2
            id="ai-brief"
            className="flex items-center gap-2 text-base font-bold"
          >
            <ListTodo className="size-5 text-primary-ink" aria-hidden />{" "}
            {t("easy.aiws.brief_title")}
          </h2>
          <ul className="mt-3 space-y-2">
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
      ) : null}

      {feed && feed.items.length ? (
        <section
          aria-labelledby="ai-feed"
          className="rounded-2xl bg-primary-soft/60 p-4"
          data-ai-feed
        >
          <div className="flex items-baseline justify-between gap-3">
            <h2
              id="ai-feed"
              className="flex items-center gap-2 text-base font-bold"
            >
              <Target className="size-5 text-primary-ink" aria-hidden />{" "}
              {feed.title}
            </h2>
            <Link
              href={feed.href}
              className="-my-2 inline-flex min-h-11 shrink-0 items-center gap-0.5 text-sm font-semibold text-primary-ink hover:underline"
            >
              {t("easy.aiws.feed.see_all", { count: feed.total })}{" "}
              <ChevronRight className="size-4" aria-hidden />
            </Link>
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {feed.subtitle}
          </p>
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
      ) : null}

      {/* telefon va planshet: tezkor imkoniyatlar — o'ng panel yo'q */}
      <div className="lg:hidden">
        <QuickActions quick={quick} onPrompt={onPrompt} chat={chat} compact />
      </div>

      <div>
        <p className="text-sm font-semibold text-muted-foreground">
          {t("easy.finder.try_label")}
        </p>
        <ul className="mt-2 flex flex-wrap gap-2">
          {examples.map((ex) => (
            <li key={ex} className="flex">
              <button
                type="button"
                disabled={chat.pending}
                onClick={() => onPrompt(ex)}
                className="press inline-flex min-h-11 items-center gap-2 rounded-full border border-primary/30 bg-primary-soft px-3.5 text-left text-sm font-semibold text-primary-ink hover:border-primary/60 sm:text-base"
              >
                <Sparkles className="size-4 shrink-0" aria-hidden />
                {ex}
              </button>
            </li>
          ))}
        </ul>
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
  const chip =
    "press inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border border-border bg-card px-3.5 text-sm font-semibold hover:border-primary/50 disabled:opacity-50";
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
      <ul
        className={cn(
          "mt-2",
          compact
            ? "-mx-3 flex gap-2 overflow-x-auto px-3 pb-1 [scrollbar-width:thin] sm:-mx-5 sm:px-5"
            : "space-y-0.5",
        )}
      >
        {quick.map((q) => {
          const Icon = ICONS[q.icon];
          const inner: ReactNode = (
            <>
              <span
                className={cn(
                  "flex shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-ink",
                  compact ? "size-6" : "size-9",
                )}
                aria-hidden
              >
                <Icon className={compact ? "size-3.5" : "size-4"} />
              </span>
              <span className="min-w-0 flex-1 truncate">{q.label}</span>
              {!compact ? (
                <ChevronRight
                  className="size-4 shrink-0 text-muted-foreground"
                  aria-hidden
                />
              ) : null}
            </>
          );
          return (
            <li key={q.key} className="flex shrink-0">
              {q.href ? (
                <Link
                  href={q.href}
                  className={compact ? chip : item}
                  data-quick={q.key}
                >
                  {inner}
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => onPrompt(q.prompt ?? q.label)}
                  disabled={chat.pending}
                  className={compact ? chip : item}
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
  promo,
  tips,
  chat,
  onPrompt,
}: {
  quick: QuickAction[];
  promo: Props["promo"];
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
      <section
        className="relative overflow-hidden rounded-2xl bg-primary-soft p-4"
        data-ai-promo
      >
        <span
          className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground"
          aria-hidden
        >
          <Compass className="size-6" />
        </span>
        <h2 className="mt-3 text-lg font-extrabold leading-tight">
          {promo.title}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{promo.desc}</p>
        <Button
          type="button"
          className="mt-3 text-base"
          onClick={() => onPrompt(promo.prompt)}
          disabled={chat.pending}
        >
          {promo.cta} <ArrowRight className="size-4" aria-hidden />
        </Button>
      </section>

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
