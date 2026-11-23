"use client";

import { createContext, Suspense, use, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, BriefcaseBusiness, Check, ChevronDown, ClipboardList, Info, MapPin, PenLine, Phone, Plus, RotateCcw, UsersRound } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { AiAvatar } from "@/components/shared/ai-avatar";
import { AiPromptBox } from "@/features/find/components/ai-chat";
import { AiJobCard, AiWorkerCard, type CardImage } from "@/features/find/components/ai-cards";
import { ListingImageDraft, type DraftImage } from "@/features/listing-image/components/listing-image-draft";
import { vacancyPhotoUrl } from "@/features/post/photo";
import { WORKER_NOTE_PRESETS } from "@/features/post/notes";
import { VacancyDescription } from "@/features/jobs/components/vacancy-description";
import type { QuickList } from "@/features/find/quick-types";
import { POST_EXPERIENCES } from "@/features/find/quick-post-types";
import { CheckoutPanel } from "@/features/billing/components/checkout-panel";
import { formatPhone } from "@/lib/format";
import type { AppMode } from "@/features/mode/mode";
import { useGuidedChat, type AiPart, type GuidedChat, type Msg, type Role } from "../guided";
import { ChoicePicker, NextOption, PlaceIcon, ProfessionChoices } from "./chat-pickers";
import { chatProfessionsWithListings, type ChatProfessionCount } from "../actions";
import { ChatIntro } from "./chat-intro";
import { HomeStart } from "./home-start";
import type { HomeData, HomeLatest } from "../home";

/** Vakansiya joylash — yordamchi bilan alohida ekran (ishchi e'loni esa shu chatning o'zida, 3-bosqich) */
export function vacancyHref(text = ""): string {
  const q = text.replace(/\s+/g, " ").trim().slice(0, 300);
  return `/post/vacancy?${new URLSearchParams({ ai: "1", ...(q ? { q } : {}) }).toString()}`;
}

/** Chatda birinchi ko'rinadigan kartalar soni (qolgani "Yana N tasini ko'rsatish" bilan) */
const FIRST = 3;

/**
 * Asosiy ekran — chat. Bo'sh holatda — bosh ekran (ega, 2026-11-23, C varianti; home-start.tsx): sarlavha, qidiruv qatori
 * (kasb + hudud), uchta tugma (Ish qidiryapman / Ishchi qidiryapman / sariq E'lon berish), tezkor bo'limlar va eng yangi
 * e'lonlar. Bosh ekran ma'lumoti bo'lmasa (xato) — avvalgi ekran (2026-11-22): tepada qisqa video-tushuntirish,
 * «Ish yoki ishchini oson toping» va ikki katta tugma — «Ish qidiryapman» / «Ishchi qidiryapman»; keyin
 * ketma-ket: kasb (3 ta + hammasi + qidiruv) → viloyat → «Endi nima qilamiz?». Yozish ham ishlaydi: yozilgach —
 * AI maqsadni o'zi aniqlaydi, yetishmaganini bittadan muloyim so'raydi (hudud — tugmalar), natijalar shu chatda kartalar
 * bilan. Mehmon ham, kirgan foydalanuvchi ham — bir xil ekran. Telegram kanal — kirgandan keyin chiqadigan oynada
 * (ChannelPrompt), bu yerda emas.
 */
export function StartChat({
  mode,
  owner,
  initialQuery = "",
  post = null,
  introSeen = false,
  imageEnabled = false,
  home = null,
  initialRegion = null,
}: {
  mode: AppMode | null;
  /** foydalanuvchi id yoki "guest" — suhbat shu odamniki */
  owner: string;
  /** ?q=… — sekin telefonda skriptlar yuklanmasdan yuborilgan matn: yuklangach o'zi yuboriladi */
  initialQuery?: string;
  /**
   * ?post=1 — mehmon e'lonni joylash uchun kirib qaytdi: o'sha e'lon kartasi "Joylash" bilan qaytadi;
   * ?post=new — "E'lonlarim"dagi "+ E'lon joylash": e'lon savollari darhol boshlanadi
   */
  post?: "resume" | "new" | null;
  /** video-tushuntirish ko'rilgan/yopilgan (cookie) — yig'ilgan holda ("Qanday ishlaydi?") */
  introSeen?: boolean;
  /** AI e'lon rasmi sozlangan (OpenAI kaliti) — e'lon kartasida joylashdan oldin "Rasm yaratish" */
  imageEnabled?: boolean;
  /** bosh ekran (qidiruv qatori, hududlar, eng yangi e'lonlar) — bo'lmasa avvalgi ikki tugmali ekran */
  home?: HomeData | null;
  /** ?region=… — skriptlar yuklanmasdan qidiruv qatoridan yuborilgan hudud */
  initialRegion?: string | null;
}) {
  const { t } = useT();
  const chat = useGuidedChat(mode, owner);
  const sent = useRef(false);
  useEffect(() => {
    if (!chat.ready || sent.current || !initialQuery) return;
    sent.current = true;
    // manzildan q olib tashlanadi — sahifa yangilansa savol qayta yuborilmaydi
    window.history.replaceState(null, "", window.location.pathname);
    const place = initialRegion ? home?.places.find((p) => p.value === initialRegion) : undefined;
    if (place) chat.find(initialQuery, place);
    else chat.ask(initialQuery);
  }, [chat, initialQuery, initialRegion, home]);
  const posted = useRef(false);
  useEffect(() => {
    if (!chat.ready || posted.current || !post) return;
    posted.current = true;
    window.history.replaceState(null, "", window.location.pathname);
    if (post === "resume") chat.resumePost();
    else chat.beginPost("", t("easy.guided.post_new_you"));
  }, [chat, post, t]);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const who = mode === "employer" ? "employer" : mode === "worker" ? "worker" : "guest";
  // ko'rsatma — har savolga mos (ega, 2026-11-22: "telefon so'raganda «Masalan: men oshpazman» nima bu — har so'rovda o'zgarsin")
  const placeholder = chat.awaiting ? t(`easy.guided.placeholder_${chat.awaiting}`) : t(`easy.guided.placeholder_${who}`);
  // skriptlarsiz yuborilgan matn shu sahifaning o'ziga qaytadi (mehmon — "/", kirgan — "/chat")
  const action = owner === "guest" ? "/" : "/chat";
  const empty = !chat.msgs.length;

  return (
    <ImageEnabled.Provider value={imageEnabled}>
      {/* bosh ekran kompyuterda kengroq (ega, 2026-11-23: "sahifa juda tor"); suhbat — o'qish uchun tor ustunda */}
      <div
        className={cn(
          "flex min-h-[calc(100dvh-var(--tabbar-height)-4rem)] flex-col",
          // .container-narrow (utilities qatlami) lg:max-w-* ni bosib ketadi — bosh ekranda kenglik shu yerda to'liq beriladi
          empty && home ? "mx-auto w-full max-w-2xl px-4 sm:px-6 lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl" : "container-narrow",
        )}
        data-start-chat
        data-chat-mode={mode ?? "guest"}
      >
        {empty && home ? (
          <HomeStart
            chat={chat}
            mode={home.mode}
            places={home.places}
            place={home.place}
            action={action}
            introSeen={introSeen}
            latest={
              <Suspense fallback={null}>
                <Latest promise={home.latest} />
              </Suspense>
            }
          />
        ) : empty ? (
          // bo'sh holat: video-tushuntirish, sarlavha va ikki katta tugma (ketma-ketlik shu yerdan boshlanadi)
          <div className="flex flex-1 flex-col gap-4 py-4" data-guided-empty>
            <ChatIntro seen={introSeen} />
            <h1 className="mx-auto mt-1 max-w-xs text-center text-2xl font-extrabold leading-tight tracking-tight [overflow-wrap:anywhere] sm:max-w-md sm:text-3xl">{t("easy.guided.hello")}</h1>
            <RoleStart chat={chat} onPick={chat.start} />
          </div>
        ) : (
          <div className="flex-1 py-6">
            {/* suhbat paytida sarlavha ko'rinmaydi (joy suhbatga), lekin sahifaning nomi sifatida qoladi */}
            <h1 className="sr-only">{t(home ? "easy.guided.home.title" : "easy.guided.hello")}</h1>
            <Thread chat={chat} />
          </div>
        )}

        {/* yozish maydoni pastda yopishgan; klaviatura ochilganda pastki menyu yashiriladi (globals.css: .chat-composer) */}
        {/* bosh ekranda yozish o'rnini qidiruv qatori egallaydi (ikkita matn maydoni bo'lmasin); suhbat boshlangach — shu */}
        <div className={cn("chat-composer sticky z-10 -mx-1 bg-background px-1 pb-2 pt-2", empty && home && "hidden")} data-tour="composer">
          <AiPromptBox chat={chat} id="start-chat-text" inputRef={inputRef} note={false} placeholder={placeholder} action={action} inputMode={chat.awaiting === "post_phone" ? "tel" : undefined} />
        </div>
      </div>
    </ImageEnabled.Provider>
  );
}

function Thread({ chat }: { chat: GuidedChat }) {
  const { t } = useT();
  const lastRef = useRef<HTMLLIElement>(null);
  const last = chat.msgs.at(-1);
  const lastKey = last ? `${last.id}:${last.ai?.kind ?? "you"}` : "";
  useEffect(() => {
    if (lastKey) lastRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [lastKey]);

  return (
    <div className="space-y-4" data-guided-thread>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={chat.clear}
          disabled={chat.pending}
          className="press -my-2 inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-muted-foreground hover:text-foreground disabled:opacity-50"
          data-guided-new
        >
          <RotateCcw className="size-4" aria-hidden /> {t("easy.finder.new_chat")}
        </button>
      </div>
      <ol className="space-y-4" aria-live="polite" aria-busy={chat.pending}>
        {chat.msgs.map((m) => (
          <li key={m.id} ref={m.id === last?.id ? lastRef : undefined} className="scroll-mt-16 scroll-mb-40">
            {m.you !== undefined ? (
              <div className="ai-bubble-in flex justify-end">
                <p data-ai-you className="max-w-[85%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-base text-primary-foreground [overflow-wrap:anywhere]">
                  <span className="sr-only">{t("easy.finder.you")}: </span>
                  {m.you}
                </p>
              </div>
            ) : m.ai ? (
              <Answer msg={m} part={m.ai} chat={chat} latest={m.id === last?.id} />
            ) : null}
          </li>
        ))}
      </ol>
    </div>
  );
}

function Ai({ children, busy = false, kind }: { children: ReactNode; busy?: boolean; kind: string }) {
  const { t } = useT();
  return (
    <div className="ai-bubble-in flex items-start gap-2.5" data-guided-ai={kind}>
      <AiAvatar busy={busy} size="sm" className="mt-1 shrink-0" />
      <div className="min-w-0 flex-1 space-y-3">
        <span className="sr-only">{t("easy.finder.assistant_title")}: </span>
        {children}
      </div>
    </div>
  );
}

function Say({ children }: { children: ReactNode }) {
  return <p className="rounded-2xl rounded-tl-md bg-secondary px-4 py-3 text-base leading-relaxed [overflow-wrap:anywhere]">{children}</p>;
}

function Answer({ msg, part, chat, latest }: { msg: Msg; part: AiPart; chat: GuidedChat; latest: boolean }) {
  const { t } = useT();
  const open = !msg.answered && latest && !chat.pending;

  switch (part.kind) {
    case "thinking":
    case "searching":
      return (
        <Ai kind={part.kind} busy>
          <p className="inline-flex items-center gap-3 px-1 py-2 text-muted-foreground" role="status">
            <span className="ai-dots text-primary-ink" aria-hidden>
              <span />
              <span />
              <span />
            </span>
            <span className="text-sm font-semibold">{part.kind === "thinking" ? (part.text ?? t("easy.guided.thinking")) : t(`easy.guided.searching_${part.mode}`)}</span>
          </p>
        </Ai>
      );

    case "reply":
      return (
        <Ai kind="reply">
          <Say>{part.text}</Say>
        </Ai>
      );

    case "error":
      return (
        <Ai kind="error">
          <p role="alert" className="rounded-2xl rounded-tl-md bg-destructive-soft px-4 py-3 text-base text-destructive">
            {part.message}
          </p>
        </Ai>
      );

    case "post": {
      // vakansiya — yordamchi bilan alohida ekran; kimligi noma'lum — "O'zim haqimda" shu chatda davom etadi
      const text = part.who === "employer" ? t("easy.guided.post_employer") : t("easy.guided.post_ask");
      return (
        <Ai kind="post">
          <Say>{text}</Say>
          <div className="flex flex-wrap gap-2" data-guided-post>
            {part.who !== "employer" && open ? (
              <Button type="button" className="h-auto min-h-11 whitespace-normal py-2 text-base" onClick={() => chat.beginPost(part.query, t("easy.guided.post_who_worker"))} data-guided-post-to="worker">
                <Plus className="size-5" aria-hidden /> {t("easy.guided.post_who_worker")}
              </Button>
            ) : null}
            {part.who !== "worker" ? (
              <Button asChild variant={part.who ? "default" : "outline"} className="h-auto min-h-11 whitespace-normal py-2 text-base" data-guided-post-to="employer">
                <Link href={vacancyHref(part.query)}>
                  <Plus className="size-5" aria-hidden /> {part.who ? t("easy.guided.post_employer_btn") : t("easy.guided.post_who_employer")}
                </Link>
              </Button>
            ) : null}
          </div>
        </Ai>
      );
    }

    case "post-ask":
      return <PostAsk part={part} chat={chat} open={open} />;

    case "post-preview":
      return <PostPreviewCard part={part} chat={chat} open={open} />;

    case "post-done":
      return <PostDone part={part} />;

    case "ask": {
      if (part.ask === "role") {
        // savol matnisiz — faqat ikki variant (ega, 2026-11-22: "so'ramasin, 2 ta variant chiqsin ekranga")
        // javob berilgach — hech narsa (tanlangan rol foydalanuvchi xabari sifatida ko'rinadi)
        return open ? (
          <Ai kind="ask-role">
            <RoleStart chat={chat} onPick={chat.pickRole} roles />
          </Ai>
        ) : null;
      }
      if (part.ask === "profession") {
        const mode = part.mode ?? "jobs";
        return (
          <Ai kind="ask-profession">
            <Say>{part.word ? t("easy.guided.ask_prof_unknown", { word: part.word }) : t(`easy.guided.ask_prof_${mode}`)}</Say>
            {open ? (
              <ProfessionChoices
                mode={mode}
                onPick={chat.pickProfession}
                lead={{ key: "any", label: t(mode === "jobs" ? "easy.guided.any_jobs" : "easy.guided.any_workers"), onClick: () => chat.pickAnyProfession(t(mode === "jobs" ? "easy.guided.any_jobs" : "easy.guided.any_workers")) }}
              />
            ) : null}
          </Ai>
        );
      }
      const mode = part.mode ?? "jobs";
      return (
        <Ai kind="ask-place">
          <Say>{t(`easy.guided.ask_place_${mode}`)}</Say>
          {open && part.options?.length ? (
            <ChoicePicker
              attr="guided-place"
              icon={PlaceIcon}
              items={part.options.map((o) => ({ key: o.value, label: o.label, onClick: () => chat.pickPlace(o) }))}
              moreLabel={(n) => t("easy.guided.pick_all_places", { count: n })}
              searchPlaceholder={t("easy.guided.pick_search_place")}
            />
          ) : null}
        </Ai>
      );
    }

    case "next": {
      // "Endi nima qilamiz?" — kasb va hudud tayyor (ega, 2026-11-22)
      const jobs = part.mode === "jobs";
      const prof = part.draft.profession.trim();
      return (
        <Ai kind="next">
          <div className="flex flex-wrap items-center gap-1.5" data-guided-summary>
            {prof ? <span className="inline-flex min-h-8 items-center rounded-lg border border-border bg-card px-3 text-sm font-semibold">{prof}</span> : null}
            <span className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-border bg-card px-3 text-sm font-semibold">
              <MapPin className="size-3.5 text-primary-ink" aria-hidden /> {part.label}
            </span>
          </div>
          <Say>{t("easy.guided.next_ask")}</Say>
          {open ? (
            <div className="grid gap-2.5" data-guided-next>
              <NextOption
                primary
                icon={<ClipboardList />}
                title={t(jobs ? "easy.guided.next_see_jobs" : "easy.guided.next_see_workers")}
                sub={t(jobs ? "easy.guided.next_see_jobs_sub" : "easy.guided.next_see_workers_sub")}
                onClick={() => chat.chooseNext("see", part.draft, part.mode, t(jobs ? "easy.guided.next_see_jobs" : "easy.guided.next_see_workers"))}
                data-guided-next-to="see"
              />
              {jobs ? (
                <NextOption
                  icon={<PenLine />}
                  title={t("easy.guided.next_post_worker")}
                  sub={t("easy.guided.next_post_worker_sub")}
                  onClick={() => chat.chooseNext("post", part.draft, part.mode, t("easy.guided.next_post_worker"))}
                  data-guided-next-to="post"
                />
              ) : (
                <NextOption icon={<PenLine />} title={t("easy.guided.next_post_vacancy")} sub={t("easy.guided.next_post_vacancy_sub")} href={vacancyHref(prof)} data-guided-next-to="vacancy" />
              )}
            </div>
          ) : null}
        </Ai>
      );
    }

    case "results":
      return <Results part={part} chat={chat} latest={latest} />;
  }
}

/**
 * Ikki katta tugma — "Ish qidiryapman" / "Ishchi qidiryapman": bo'sh ekranda (ketma-ketlik boshlanadi) va rol noma'lum
 * bo'lganda suhbat ichida (`roles` — data-guided-role belgisi bilan)
 */
function RoleStart({ chat, onPick, roles = false }: { chat: GuidedChat; onPick: (r: Role, label: string) => void; roles?: boolean }) {
  const { t } = useT();
  // bo'sh ekrandagi tugmalar — tanishuvda ham yoritiladi (data-tour)
  const tag = (r: Role) => (roles ? { "data-guided-role": r } : { "data-guided-start": r, "data-tour": r === "jobs" ? "start-jobs" : "start-workers" });
  return (
    <div className="grid gap-2.5" data-guided-roles={roles ? "" : undefined} data-guided-starts={roles ? undefined : ""}>
      <NextOption primary icon={<BriefcaseBusiness />} title={t("easy.guided.start_jobs")} sub={t("easy.guided.start_jobs_sub")} disabled={chat.pending} onClick={() => onPick("jobs", t("easy.guided.start_jobs"))} {...tag("jobs")} />
      <NextOption icon={<UsersRound />} title={t("easy.guided.start_workers")} sub={t("easy.guided.start_workers_sub")} disabled={chat.pending} onClick={() => onPick("workers", t("easy.guided.start_workers"))} {...tag("workers")} />
    </div>
  );
}

/** Bosh ekrandagi eng yangi haqiqiy e'lonlar (2 ta) va "Barcha vakansiyalar (N)"; yo'q yoki xato — bo'lim ko'rinmaydi */
function Latest({ promise }: { promise: Promise<HomeLatest | null> }) {
  const { t } = useT();
  const data = use(promise);
  if (!data) return null;
  const jobs = data.mode === "jobs";
  return (
    <section aria-labelledby="home-latest" className="space-y-3" data-home-latest={data.mode}>
      <h2 id="home-latest" className="text-xl font-extrabold">
        {t(jobs ? "easy.guided.home.latest_jobs" : "easy.guided.home.latest_workers")}
      </h2>
      <CardList list={data.list} saved={data.saved} limit={2} wide />
      <Link
        href={data.allHref}
        prefetch={false}
        className="press flex min-h-12 items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 text-base font-bold text-primary-ink hover:border-primary/50 lg:mx-auto lg:w-fit lg:px-10"
        data-track="search_all"
        data-home-all
      >
        {t(jobs ? "easy.guided.home.all_jobs" : "easy.guided.home.all_workers", { count: data.list.total })}
        <ArrowRight className="size-5 shrink-0" aria-hidden />
      </Link>
    </section>
  );
}

function CardList({ list, saved, limit, wide }: { list: QuickList; saved: string[]; limit: number; wide?: boolean }) {
  // rasm bilan (ega, 2026-11-22: "ilovada ham rasm bilan ko'rinsin"): haqiqiy ish joyi surati, bo'lmasa — AI e'lon rasmi
  const jobImage = (id: string): CardImage | null => {
    const photo = vacancyPhotoUrl(list.photos[id]);
    if (photo) return { src: photo, ai: false };
    const ai = list.aiImages?.[id];
    return ai ? { src: ai, ai: true } : null;
  };
  return (
    <ul className={cn("grid grid-cols-1 gap-3", wide && "items-start lg:grid-cols-2 lg:gap-4")} data-guided-cards>
      {list.jobs.slice(0, limit).map((job) => (
        <li key={job.id}>
          <AiJobCard job={job} saved={saved.includes(job.id)} image={jobImage(job.id)} />
        </li>
      ))}
      {list.workers.slice(0, limit).map((w) => (
        <li key={w.id}>
          <AiWorkerCard worker={w} saved={saved.includes(w.id)} image={list.aiImages?.[w.id] ? { src: list.aiImages[w.id]!, ai: true } : null} />
        </li>
      ))}
    </ul>
  );
}

function Results({ part, chat, latest }: { part: Extract<AiPart, { kind: "results" }>; chat: GuidedChat; latest: boolean }) {
  const { t } = useT();
  const [expanded, setExpanded] = useState(false);
  const r = part.result;
  const jobs = part.mode === "jobs";
  const loaded = r.jobs.length + r.workers.length;
  const shown = expanded ? loaded : Math.min(loaded, FIRST);

  const summary = (
    <div className="flex flex-wrap items-center gap-1.5" data-guided-summary>
      {r.summary.map((s) => (
        <span key={s} className="inline-flex min-h-8 items-center rounded-full bg-secondary px-3 text-sm font-semibold text-foreground">
          {s}
        </span>
      ))}
    </div>
  );

  if (r.total > 0) {
    return (
      <Ai kind="results">
        <Say>{jobs ? t("easy.guided.found_jobs", { count: r.total }) : t("easy.guided.found_workers", { count: r.total })}</Say>
        {summary}
        <CardList list={r} saved={r.saved} limit={shown} />
        {loaded > shown ? (
          <Button type="button" variant="outline" size="lg" fullWidth className="text-base" onClick={() => setExpanded(true)} data-guided-more>
            <ChevronDown className="size-5" aria-hidden /> {t("easy.guided.more", { count: loaded - shown })}
          </Button>
        ) : r.total > loaded ? (
          <Button asChild variant="outline" size="lg" fullWidth className="text-base" data-guided-all>
            <Link href={r.href}>
              {t("easy.guided.all", { count: r.total })} <ArrowRight className="size-5" aria-hidden />
            </Link>
          </Button>
        ) : null}
        {/* e'lonlar ostida kichik yozuv (ega, 2026-11-22: "mavjud e'lonlarni ko'rdi — tagida kichkina «+ E'lon joylash»"):
            ish izlovchi — o'zi haqida (shu chatda, qidirilgan kasb bilan), ish beruvchi — vakansiya */}
        {latest ? (
          jobs ? (
            <button
              type="button"
              disabled={chat.pending}
              onClick={() => chat.beginPost(part.query, t("easy.finder.empty_post_worker"))}
              className="press inline-flex min-h-11 items-center gap-1 self-start rounded-lg px-1 text-sm font-bold text-primary-ink hover:underline"
              data-guided-post-link="worker"
            >
              <Plus className="size-4" aria-hidden /> {t("easy.guided.post_link")}
            </button>
          ) : (
            <Link href={vacancyHref(part.query)} className="press inline-flex min-h-11 items-center gap-1 self-start rounded-lg px-1 text-sm font-bold text-primary-ink hover:underline" data-guided-post-link="vacancy">
              <Plus className="size-4" aria-hidden /> {t("easy.guided.post_link")}
            </Link>
          )
        ) : null}
      </Ai>
    );
  }

  return (
    <Ai kind="none">
      <Say>{jobs ? t("easy.guided.none_jobs") : t("easy.guided.none_workers")}</Say>
      {summary}
      {r.save === "saved" || r.save === "exists" ? (
        <p className="flex gap-2 text-sm text-muted-foreground">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden /> {t("easy.quick.saved")}
        </p>
      ) : null}
      {latest ? (
        <div className={cn("space-y-2 rounded-2xl border border-border bg-card p-3")} data-guided-none>
          <p className="text-base">{jobs ? t("easy.guided.none_post_worker") : t("easy.guided.none_post_employer")}</p>
          {jobs ? (
            // o'zi haqida e'lon — shu chatning o'zida, qidirilgan kasb bilan boshlanadi (3-bosqich)
            <Button type="button" className="h-auto min-h-11 w-full whitespace-normal py-2 text-base" disabled={chat.pending} onClick={() => chat.beginPost(part.query, t("easy.finder.empty_post_worker"))} data-quick-post="worker">
              <Plus className="size-5" aria-hidden /> {t("easy.finder.empty_post_worker")}
            </Button>
          ) : (
            <Button asChild className="h-auto min-h-11 w-full whitespace-normal py-2 text-base" data-quick-post="vacancy">
              <Link href={vacancyHref(part.query)}>
                <Plus className="size-5" aria-hidden /> {t("easy.finder.empty_post_vacancy")}
              </Link>
            </Button>
          )}
          {part.draft.place !== "all" ? (
            <Button type="button" variant="outline" className="h-auto min-h-11 w-full whitespace-normal py-2 text-base" disabled={chat.pending} onClick={() => chat.otherPlace(part.draft, part.mode)} data-guided-other-place>
              <MapPin className="size-5" aria-hidden /> {t("easy.guided.other_place")}
            </Button>
          ) : null}
        </div>
      ) : null}
      {latest && !r.similar ? <Suggested part={part} chat={chat} /> : null}
      {latest && r.similar ? (
        <section className="space-y-2" data-guided-similar={r.similar.kind}>
          <h3 className="text-base font-bold">{jobs ? t("easy.quick.similar_near_jobs") : t("easy.quick.similar_near_workers")}</h3>
          <CardList list={r.similar} saved={r.similar.saved} limit={FIRST} />
        </section>
      ) : null}
    </Ai>
  );
}

/**
 * Hech narsa topilmadi va yaqini ham yo'q — "boshqa qidiruv" takliflari: hozir e'lonlari BOR kasblar (soni bilan, butun
 * O'zbekiston bo'yicha). Ma'lumot haqiqiy: sanalgan ochiq e'lonlar (ega, 2026-11-22: soxta natija yo'q).
 */
function Suggested({ part, chat }: { part: Extract<AiPart, { kind: "results" }>; chat: GuidedChat }) {
  const { t } = useT();
  const [list, setList] = useState<ChatProfessionCount[] | null>(null);
  const mode = part.mode;
  const exclude = part.draft.nodeId;
  useEffect(() => {
    let alive = true;
    chatProfessionsWithListings({ mode, exclude }).then(
      (r) => alive && setList(r),
      () => alive && setList([]),
    );
    return () => {
      alive = false;
    };
  }, [mode, exclude]);
  if (!list?.length) return null;
  return (
    <section className="space-y-2" data-guided-suggested>
      <h3 className="text-base font-bold">{t(mode === "jobs" ? "easy.guided.suggest_jobs" : "easy.guided.suggest_workers")}</h3>
      <ul className="flex flex-wrap gap-2">
        {list.map((p) => (
          <li key={p.id} className="flex max-w-full">
            <button
              type="button"
              disabled={chat.pending}
              onClick={() => chat.searchSuggested(p, part.draft, mode)}
              className="press flex min-h-11 max-w-full items-center gap-2 rounded-lg border border-border-strong bg-card px-3.5 py-2 text-left text-sm font-semibold text-foreground shadow-sm hover:border-primary/50 hover:bg-primary-soft/40"
              data-guided-suggest={p.id}
            >
              <span className="min-w-0 [overflow-wrap:anywhere]">{p.name}</span>
              <span className="shrink-0 rounded-full bg-secondary px-2 text-xs font-bold text-muted-foreground">{p.count}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Pastdagi tugmalar (viloyat, "aynan qaysi biri", tajriba): o'z kengligida, qatorma-qator */
function Pills({ items, attr }: { items: { key: string; label: string; onClick: () => void }[]; attr: string }) {
  return (
    <ul className="flex flex-wrap gap-2" {...{ [`data-post-${attr}s`]: "" }}>
      {items.map((it) => (
        <li key={it.key} className="flex max-w-full">
          <button
            type="button"
            onClick={it.onClick}
            className="press flex min-h-11 max-w-full items-center rounded-lg border border-border-strong bg-card px-4 py-2 text-left text-sm font-semibold text-foreground shadow-sm hover:border-primary/50 hover:bg-primary-soft/40"
            {...{ [`data-post-${attr}`]: it.key }}
          >
            <span className="min-w-0 [overflow-wrap:anywhere]">{it.label}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

/**
 * Chatda ishchi e'loni — bittadan savol (ega, 2026-11-21: "kasb, viloyat, ism, tajriba — tajriba bormi degan joyiga
 * yozsin"): kasb, ism, tajriba, telefon — yoziladi; viloyat va "aynan qaysi biri" — tugmalar; tajriba — yozsa ham, bossa ham
 */
function PostAsk({ part, chat, open }: { part: Extract<AiPart, { kind: "post-ask" }>; chat: GuidedChat; open: boolean }) {
  const { t } = useT();
  const intro = part.intro ? <Say>{t("easy.guided.post_intro")}</Say> : null;
  const kind = `post-${part.ask.replace("post_", "")}`;
  switch (part.ask) {
    case "post_profession":
      return (
        <Ai kind={kind}>
          {intro}
          <Say>{part.word ? t("easy.guided.ask_post_prof_unknown", { word: part.word }) : t("easy.guided.ask_post_prof")}</Say>
          {open ? (
            <ProfessionChoices
              mode="jobs"
              attr="post-prof"
              // aniq kasb — darhol; guruh ("O'qituvchi") — "aynan qaysi biri?" variantlari bilan
              onPick={(p) => (p.selectable ? chat.pickPostChoice({ id: p.id, name: p.name }) : chat.ask(p.name))}
            />
          ) : null}
        </Ai>
      );
    case "post_which":
      return (
        <Ai kind={kind}>
          {intro}
          <Say>{part.question ?? t("easy.guided.ask_post_prof")}</Say>
          {open ? (
            // ega, 2026-11-22: "boshida 3 tasi ko'rinsin, «Tanlash» bosilsa hammasi chiqsin yoki qidiruvga yozsin"
            <ChoicePicker
              attr="post-choice"
              items={(part.groups ?? []).flatMap((g) => g.items.map((c) => ({ key: c.id, label: c.name, group: g.title, onClick: () => chat.pickPostChoice(c) })))}
              searchPlaceholder={t("easy.guided.pick_search_prof")}
            />
          ) : null}
        </Ai>
      );
    case "post_region":
      return (
        <Ai kind={kind}>
          {intro}
          <Say>{part.retry ? t("easy.guided.ask_post_region_tap") : t("easy.guided.ask_post_region")}</Say>
          {open && part.options?.length ? (
            <ChoicePicker
              attr="post-region"
              icon={PlaceIcon}
              items={part.options.map((o) => ({ key: o.value, label: o.label, onClick: () => chat.pickPostRegion(o) }))}
              moreLabel={(n) => t("easy.guided.pick_all_places", { count: n })}
              searchPlaceholder={t("easy.guided.pick_search_place")}
            />
          ) : null}
        </Ai>
      );
    case "post_name":
      return (
        <Ai kind={kind}>
          {intro}
          <Say>{part.retry ? t("easy.guided.ask_post_name_retry") : t("easy.guided.ask_post_name")}</Say>
        </Ai>
      );
    case "post_experience":
      return (
        <Ai kind={kind}>
          {intro}
          <Say>{part.retry ? t("easy.guided.ask_post_exp_retry") : t("easy.guided.ask_post_exp")}</Say>
          {open ? (
            <Pills
              attr="exp"
              items={POST_EXPERIENCES.map((x) => {
                const label = t(`easy.worker.exp.${x}`);
                return { key: x, label, onClick: () => chat.pickPostExperience(x, label) };
              })}
            />
          ) : null}
        </Ai>
      );
    case "post_note":
      // ixtiyoriy izoh (ega, 2026-11-22): tayyor variantlar (bir nechtasi) yoki pastda o'z so'zi bilan; e'longa ✅ bilan
      return (
        <Ai kind={kind}>
          {intro}
          <Say>{t("easy.guided.ask_post_note")}</Say>
          {open ? (
            <div className="space-y-2.5" data-post-notes>
              <ul className="flex flex-wrap gap-2">
                {WORKER_NOTE_PRESETS.map((k) => {
                  const label = t(`easy.notes.worker.${k}`);
                  const on = chat.notePicks.includes(label);
                  return (
                    <li key={k}>
                      <button
                        type="button"
                        aria-pressed={on}
                        disabled={chat.pending}
                        onClick={() => chat.toggleNotePick(label)}
                        className={cn("press inline-flex min-h-11 items-center gap-1.5 rounded-lg border px-3 text-sm font-semibold", on ? "border-primary bg-primary-soft text-primary-ink" : "border-border bg-card hover:border-primary/60")}
                        data-post-note={k}
                      >
                        {on ? <Check className="size-4" aria-hidden /> : null} {label}
                      </button>
                    </li>
                  );
                })}
              </ul>
              <div className="grid grid-cols-2 gap-2">
                <Button type="button" size="lg" className="text-base" disabled={chat.pending || !chat.notePicks.length} onClick={chat.pickPostNotes} data-post-notes-done>
                  {t("easy.guided.post_note_done")}
                </Button>
                <Button type="button" variant="outline" size="lg" className="text-base" disabled={chat.pending} onClick={() => chat.skipPostNotes(t("easy.guided.post_note_skip"))} data-post-notes-skip>
                  {t("easy.guided.post_note_skip")}
                </Button>
              </div>
            </div>
          ) : null}
        </Ai>
      );
    case "post_phone":
      return (
        <Ai kind={kind}>
          {intro}
          <Say>{part.retry ? t("easy.guided.ask_post_phone_retry") : t("easy.guided.ask_post_phone")}</Say>
        </Ai>
      );
  }
}

/**
 * Kartada raqamning o'rtasi yopiq ("+998 90 ••• •• 67") — ekranni kimgadir ko'rsatsa ham raqam ochilib qolmasin (to'liq
 * raqam foydalanuvchining o'z xabarida turibdi)
 */
function maskPhone(formatted: string): string {
  const parts = formatted.split(" ");
  return parts.length === 5 ? [parts[0], parts[1], "•••", "••", parts[4]].join(" ") : formatted;
}

/** "E'loningiz shunday ko'rinadi" — joylanadigan matnning o'zi; "Joylash" va uning ostida rozilik yozuvi */
/** AI e'lon rasmi sozlanganmi (StartChat → e'lon kartasi) */
const ImageEnabled = createContext(false);

function PostPreviewCard({ part, chat, open }: { part: Extract<AiPart, { kind: "post-preview" }>; chat: GuidedChat; open: boolean }) {
  const { t } = useT();
  const p = part.preview;
  const imageEnabled = useContext(ImageEnabled);
  /** joylashdan oldin yaratilgan AI rasm (ega, 2026-11-22: "ma'qul kelsa joylash") */
  const [image, setImage] = useState<DraftImage | null>(null);
  return (
    <Ai kind="post-preview">
      <Say>{t("easy.guided.post_preview")}</Say>
      <article className="space-y-2 rounded-2xl border border-border bg-card p-4 shadow-sm" data-post-card>
        <h3 className="text-lg font-bold leading-snug [overflow-wrap:anywhere]">{p.profession}</h3>
        <p className="flex flex-wrap items-center gap-x-1.5 text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{p.name}</span>
          <span aria-hidden>·</span>
          <MapPin className="size-4 shrink-0" aria-hidden />
          <span>{p.place}</span>
        </p>
        {/* izoh bandlari (✅) — yashil belgili ro'yxat bo'lib */}
        <VacancyDescription text={p.about} className="text-base [overflow-wrap:anywhere]" />
        <p className="flex items-center gap-2 text-base font-semibold" data-post-phone>
          <Phone className="size-4 shrink-0 text-primary-ink" aria-hidden />
          {maskPhone(formatPhone(p.answers.phone))}
        </p>
      </article>
      {open && imageEnabled && p.loggedIn ? (
        <ListingImageDraft entity="worker" professionId={p.answers.professionId} title={p.profession} value={image} onChange={setImage} />
      ) : null}
      {open ? (
        <div className="space-y-2">
          <Button type="button" size="lg" fullWidth className="text-base" disabled={chat.pending} onClick={() => chat.publishPost({ ...p.answers, imageDraft: image?.draft ?? null }, p.loggedIn)} data-post-publish>
            {t("easy.guided.post_publish")}
          </Button>
          {/* rozilik — "Joylash" tugmasi ostida (ega, master prompt; to'lov haqida so'z yo'q — 2026-11-21) */}
          <p className="px-1 text-sm leading-snug text-muted-foreground" data-post-consent>
            {t("easy.guided.post_consent")}
          </p>
          {!p.loggedIn ? (
            <p className="px-1 text-sm leading-snug text-muted-foreground" data-post-login-note>
              {t("easy.guided.post_login_note")}
            </p>
          ) : null}
        </div>
      ) : null}
    </Ai>
  );
}

/** Joylash natijasi — haqiqiy holat: joylandi / tekshiruvda / rad etildi / to'lov kerak */
function PostDone({ part }: { part: Extract<AiPart, { kind: "post-done" }> }) {
  const { t } = useT();
  const o = part.outcome;
  const state = o.info.state;
  const mine = (
    <Button asChild variant="outline" size="lg" fullWidth className="text-base">
      <Link href="/cabinet/elonlar">{t("easy.guided.post_mine")}</Link>
    </Button>
  );
  if (state === "listed") {
    return (
      <Ai kind="post-done">
        <Say>{t("easy.guided.post_done")}</Say>
        <div className="grid gap-2" data-post-done="listed">
          <Button asChild size="lg" fullWidth className="text-base">
            <Link href={`/listing/${o.workerId}`}>{t("easy.post_ai.done_view")}</Link>
          </Button>
          {mine}
        </div>
      </Ai>
    );
  }
  if (state === "payment_required" || state === "saved") {
    return (
      <Ai kind="post-done">
        <Say>{`${t("easy.post_ai.pay_title")}. ${t("easy.post_ai.pay_desc")}`}</Say>
        <div className="space-y-2" data-post-done={state}>
          {state === "payment_required" ? <CheckoutPanel purpose="worker_listing" targetId={o.workerId} variant="inline" /> : null}
          {mine}
        </div>
      </Ai>
    );
  }
  const key = state === "rejected" ? "rejected" : state === "verification_pending" ? "verification" : state === "review" ? "review" : "pending";
  return (
    <Ai kind="post-done">
      <Say>{`${t(`easy.moderation.${key}_title`)}. ${t(`easy.moderation.${key}_desc`)}`}</Say>
      {state === "rejected" && o.info.message ? <Say>{o.info.message}</Say> : null}
      <div className="grid gap-2" data-post-done={state}>
        {mine}
      </div>
    </Ai>
  );
}
