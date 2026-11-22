"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { ArrowUp, BadgeCheck, BriefcaseBusiness, ChevronLeft, ChevronRight, MapPin, Pencil, Phone, Plus, RotateCcw, Search, X } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { callAction } from "@/lib/action-call";
import { celebrate } from "@/lib/celebrate";
import { normalizePhone } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Dialog, Sheet } from "@/components/ui/dialog";
import { AiAvatar } from "@/components/shared/ai-avatar";
import { BackLink } from "@/components/shared/back-link";
import { ProfessionImage } from "@/components/shared/profession-image";
import { MESSAGE_MAX_CHARS } from "@/features/assistant/types";
import { PhoneInput } from "@/features/post/components/inputs";
import { PublishResult } from "@/features/post/components/publish-result";
import { ModerationOutcome } from "@/features/post/components/moderation-outcome";
import { AlertToggle } from "@/features/alerts/components/alert-toggle";
import { quickPostPrepare, quickPostPreview, quickPostPublish } from "../quick-post-actions";
import { ListingImageDraft, type DraftImage } from "@/features/listing-image/components/listing-image-draft";
import { POST_EXPERIENCES, type PostAnswers, type PostChoice, type PostChoiceGroup, type PostExperience, type PostForm, type PostOutcome, type PostPreview } from "../quick-post-types";

/**
 * "+ E'lon joylash" → Yordamchi (ega, 2026-11-17):
 *  1) yozadi: "men o'qituvchiman" (yoki "uqituvchi", "oqtvchi") → kasb tushuniladi; boshqa mavzu bo'lsa — oyna chiqmaydi;
 *  2) kerak bo'lsa: "Aynan qanday o'qituvchisiz?" — variantlar oynasi;
 *  3) oyna: kasb, ism, hudud, tajriba, telefon (oylik maosh yo'q) → "Tasdiqlash";
 *     telefon har doim qo'lda yoziladi va majburiy (hisob raqami oldindan qo'yilmaydi), "+ Yana raqam" — ikkinchisi;
 *  4) "Sizning e'loningiz shunday ko'rinadi" → "Joylash" → avtomatik tekshiruv → "Tabriklaymiz".
 * Mehmon "Joylash"ni bossa — telefonini tasdiqlab (SMS) shu yerga qaytadi va e'lon o'sha javoblar bilan joylanadi.
 */

type Turn = { id: number; kind: "user"; text: string } | { id: number; kind: "thinking" } | { id: number; kind: "reply"; text: string } | { id: number; kind: "draft" } | { id: number; kind: "error"; text: string };

interface Values {
  profession: PostChoice | null;
  firstName: string;
  lastName: string;
  regionId: string;
  /** "" — butun viloyat */
  districtId: string;
  experience: PostExperience | null;
  /** e'londagi raqam — qo'lda yoziladi (bo'sh "+998 " dan boshlanadi) */
  phone: string;
  /** "+ Yana raqam": null — maydon ochilmagan */
  phone2: string | null;
}

type Screen = "options" | "form" | "preview";

interface Flow {
  form: PostForm;
  values: Values;
  screen: Screen;
  question: string | null;
  groups: PostChoiceGroup[];
  preview: PostPreview | null;
}

const HANDOFF_KEY = "ib_ai_post_handoff";
const HANDOFF_TTL = 30 * 60 * 1000;

function initialValues(form: PostForm): Values {
  return {
    profession: form.profession,
    firstName: form.firstName,
    lastName: form.lastName,
    regionId: form.regionId ?? "",
    districtId: form.districtId ?? "",
    experience: null,
    phone: "+998 ",
    phone2: null,
  };
}

/** ikkinchi raqam: ochilmagan yoki bo'sh qoldirilgan — yo'q; birinchisi bilan bir xil — saqlanmaydi */
function secondPhone(v: Values): string | null {
  const p2 = v.phone2 === null ? null : normalizePhone(v.phone2);
  return p2 && p2 !== normalizePhone(v.phone) ? p2 : null;
}

function toAnswers(v: Values): PostAnswers | null {
  const phone = normalizePhone(v.phone);
  if (!v.profession || !v.regionId || !v.experience || !phone) return null;
  return {
    professionId: v.profession.id,
    firstName: v.firstName.trim(),
    lastName: v.lastName.trim(),
    regionId: v.regionId,
    districtId: v.districtId || null,
    experience: v.experience,
    phone,
    phone2: secondPhone(v),
  };
}

function readHandoff(): PostAnswers | null {
  try {
    const raw = window.localStorage.getItem(HANDOFF_KEY);
    window.localStorage.removeItem(HANDOFF_KEY);
    const parsed = raw ? (JSON.parse(raw) as { at?: number; answers?: PostAnswers }) : null;
    return parsed?.answers && typeof parsed.at === "number" && Date.now() - parsed.at < HANDOFF_TTL ? parsed.answers : null;
  } catch {
    return null;
  }
}

const noopSubscribe = () => () => {};

export function AiPostClient({ resume, initialText = "", imageEnabled = false }: { resume: boolean; /** asosiy chatda yozilgan birinchi gap ("Haydovchi, Chilonzor") — darhol shu bilan boshlanadi */ initialText?: string; /** e'lon rasmi (AI) sozlangan — joylangach "Rasm yaratilsinmi?" */ imageEnabled?: boolean }) {
  const { t } = useT();
  const router = useRouter();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [flow, setFlow] = useState<Flow | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  /** "Joylash"dan keyin: tekshirilmoqda / natija */
  const [publishing, setPublishing] = useState(false);
  /** tekshirish oynasida yaratilgan AI rasm (ega, 2026-11-22: "joylashdan oldin, ma'qul kelsa joylash") */
  const [image, setImage] = useState<DraftImage | null>(null);
  const [outcome, setOutcome] = useState<PostOutcome | null>(null);
  const seq = useRef(0);
  const run = useRef(0);
  const endRef = useRef<HTMLDivElement>(null);
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);

  const errorText = (code: string) => {
    for (const key of [`easy.errors.${code}`, `easy.finder.errors.${code}`, `common.errors.${code}`]) {
      const v = t(key);
      if (v !== key) return v;
    }
    return t("common.errors.generic");
  };

  const push = (turn: Turn) => setTurns((cur) => [...cur.filter((x) => x.kind !== "thinking"), turn].slice(-30));

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [turns.length, publishing, outcome]);

  /** Yozilgan matn → qisqa javob, variantlar yoki oyna */
  const ask = (raw: string) => {
    const text = raw.replace(/\s+/g, " ").trim().slice(0, MESSAGE_MAX_CHARS);
    if (!text || busy || publishing) return false;
    const r = ++run.current;
    setBusy(true);
    setOpen(false);
    setTurns((cur) => [...cur.filter((x) => x.kind !== "draft"), { id: ++seq.current, kind: "user" as const, text }, { id: ++seq.current, kind: "thinking" as const }].slice(-30));
    callAction(() => quickPostPrepare({ text })).then((res) => {
      if (run.current !== r) return;
      setBusy(false);
      if (!res.ok || !res.data) return push({ id: ++seq.current, kind: "error", text: errorText(res.ok ? "generic" : res.error) });
      const d = res.data;
      if (d.kind === "reply") return push({ id: ++seq.current, kind: "reply", text: d.reply });
      // oldingi oynadagi javoblar (ism, hudud, tajriba, telefon) qayta so'ralmaydi — faqat kasb yangilanadi
      const values = flow ? { ...flow.values, profession: d.form.profession ?? (d.kind === "options" ? null : flow.values.profession) } : initialValues(d.form);
      setFlow({
        form: d.form,
        values: { ...values, regionId: values.regionId || d.form.regionId || "", districtId: values.regionId ? values.districtId : (d.form.districtId ?? "") },
        screen: d.kind === "options" ? "options" : "form",
        question: d.kind === "options" ? d.question : null,
        groups: d.kind === "options" ? d.groups : [],
        preview: null,
      });
      push({ id: ++seq.current, kind: "draft" });
      setOpen(true);
    });
    return true;
  };

  // asosiy chatdan kelgan gap (?q=) — bir marta, sahifa tayyor bo'lgach; manzildan olib tashlanadi (yangilansa qayta yuborilmasin)
  const started = useRef(false);
  useEffect(() => {
    if (!hydrated || resume || started.current || !initialText.trim()) return;
    started.current = true;
    window.history.replaceState(null, "", window.location.pathname);
    ask(initialText);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- faqat birinchi ochilishda
  }, [hydrated]);

  // mehmon SMS bilan kirib qaytdi: o'sha javoblar bilan "Sizning e'loningiz shunday ko'rinadi" darhol ochiladi
  const resumed = useRef(false);
  useEffect(() => {
    if (!resume || resumed.current) return;
    resumed.current = true;
    window.history.replaceState(null, "", window.location.pathname);
    const answers = readHandoff();
    if (!answers) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- tashqi xotiradan (kirishdan oldingi javoblar) bir martalik tiklash
    setBusy(true);
    Promise.all([callAction(() => quickPostPrepare({ text: "" })), callAction(() => quickPostPreview(answers))]).then(([prep, prev]) => {
      setBusy(false);
      if (!prep.ok || !prep.data || prep.data.kind !== "form" || !prev.ok || !prev.data) return;
      const form = prep.data.form;
      const preview = prev.data;
      setFlow({
        form,
        values: {
          profession: { id: answers.professionId, name: preview.profession },
          firstName: answers.firstName,
          lastName: answers.lastName,
          regionId: answers.regionId,
          districtId: answers.districtId ?? "",
          experience: answers.experience,
          phone: answers.phone,
          phone2: answers.phone2,
        },
        screen: "preview",
        question: null,
        groups: [],
        preview,
      });
      setTurns([{ id: ++seq.current, kind: "draft" }]);
      setOpen(true);
    });
  }, [resume]);

  const setValues = (patch: Partial<Values>) => setFlow((f) => (f ? { ...f, values: { ...f.values, ...patch } } : f));
  const goScreen = (screen: Screen) => setFlow((f) => (f ? { ...f, screen } : f));

  /** "Joylash": mehmon — kirishga (telefon SMS), kirgan — e'lon joylanadi va avtomatik tekshiriladi */
  const publish = () => {
    const preview = flow?.preview;
    if (!flow || !preview || publishing) return;
    if (!preview.loggedIn) {
      try {
        window.localStorage.setItem(HANDOFF_KEY, JSON.stringify({ at: Date.now(), answers: preview.answers }));
      } catch {
        // xotira yopiq — kirgandan keyin oyna qaytadan to'ldiriladi
      }
      const q = new URLSearchParams({ next: "/ai/post?resume=1", phone: preview.answers.phone });
      router.push(`/auth?${q.toString()}`);
      return;
    }
    setOpen(false);
    setPublishing(true);
    callAction(() => quickPostPublish({ ...preview.answers, imageDraft: imageEnabled ? (image?.draft ?? null) : null })).then((res) => {
      setPublishing(false);
      if (!res.ok || !res.data) {
        push({ id: ++seq.current, kind: "error", text: errorText(res.ok ? "generic" : res.error) });
        if (!res.ok && res.error === "phone_required") {
          goScreen("form");
          setOpen(true);
        }
        return;
      }
      setOutcome(res.data);
      if (res.data.info.state === "listed") celebrate();
      router.refresh();
    });
  };

  if (outcome) {
    return (
      <Outcome
        outcome={outcome}
        onEdit={() => {
          setOutcome(null);
          goScreen("form");
          setOpen(true);
        }}
        onAgain={() => {
          setOutcome(null);
          setFlow(null);
          setTurns([]);
        }}
      />
    );
  }

  const status = busy ? t("easy.post_ai.thinking") : publishing ? t("easy.post_ai.checking") : t("easy.post_ai.status");

  return (
    <div className="flex min-h-dvh flex-col bg-background" data-ai-post>
      <header className="sticky top-0 z-20 border-b border-border bg-card" style={{ paddingTop: "var(--safe-top)" }}>
        <div className="mx-auto flex min-h-16 w-full max-w-3xl items-center gap-2 px-2 py-2 sm:px-4">
          <BackLink fallback="/" label={t("easy.wizard.back")} className="press flex size-11 shrink-0 items-center justify-center rounded-xl text-foreground hover:bg-secondary">
            <ChevronLeft className="size-6" aria-hidden />
          </BackLink>
          <AiAvatar busy={busy || publishing} size="md" />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-extrabold leading-tight">{t("easy.post_ai.page_title")}</h1>
            <p className="truncate text-sm text-muted-foreground" aria-live="polite">
              {t("easy.aiws.title")} · {status}
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 space-y-5 px-4 py-5 sm:px-6">
        <div className="ai-bubble-in flex items-start gap-3" data-ai-post-greeting>
          <AiAvatar size="sm" className="mt-1" />
          <div className="rounded-2xl rounded-tl-md bg-secondary px-4 py-3 text-base leading-relaxed">
            <p className="font-bold">{t("easy.post_ai.greeting")}</p>
            <p className="text-muted-foreground">{t("easy.post_ai.greeting_example")}</p>
          </div>
        </div>

        <ol className="space-y-4" aria-live="polite" aria-busy={busy || publishing}>
          {turns.map((turn) => (
            <li key={turn.id}>
              {turn.kind === "user" ? (
                <div className="ai-bubble-in flex justify-end">
                  <p data-ai-you className="max-w-[85%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-base text-primary-foreground [overflow-wrap:anywhere]">
                    <span className="sr-only">{t("easy.finder.you")}: </span>
                    {turn.text}
                  </p>
                </div>
              ) : turn.kind === "thinking" ? (
                <Assistant busy>
                  <Dots text={t("easy.post_ai.thinking")} />
                </Assistant>
              ) : turn.kind === "reply" ? (
                <Assistant>
                  <p data-ai-post-reply>{turn.text}</p>
                </Assistant>
              ) : turn.kind === "error" ? (
                <Assistant className="bg-destructive-soft text-destructive">
                  <p role="alert">{turn.text}</p>
                </Assistant>
              ) : flow ? (
                <Assistant>
                  <div className="space-y-3" data-ai-post-draft>
                    <p>{flow.values.profession ? flow.values.profession.name : t("easy.post_ai.form_title")}</p>
                    <Button type="button" className="h-11 text-base" onClick={() => setOpen(true)} disabled={busy || publishing} data-ai-post-open>
                      <Pencil className="size-5" aria-hidden /> {t("easy.quick.open_form")}
                    </Button>
                  </div>
                </Assistant>
              ) : null}
            </li>
          ))}
          {publishing ? (
            <li>
              <Assistant busy>
                <Dots text={t("easy.post_ai.checking")} />
              </Assistant>
            </li>
          ) : null}
        </ol>
        <div ref={endRef} />
      </main>

      <div className="sticky bottom-0 z-10 border-t border-border bg-card px-3 pt-3 sm:px-4" style={{ paddingBottom: "calc(0.375rem + var(--safe-bottom))" }}>
        <div className="mx-auto max-w-3xl">
          <Composer onSend={ask} busy={busy || publishing} hydrated={hydrated} />
        </div>
      </div>

      <Dialog open={open && !!flow} onOpenChange={setOpen}>
        {flow ? (
          flow.screen === "options" ? (
            <OptionsSheet
              flow={flow}
              onPick={(p) => setFlow((f) => (f ? { ...f, values: { ...f.values, profession: p }, screen: "form" } : f))}
            />
          ) : flow.screen === "form" ? (
            <FormSheet
              flow={flow}
              setValues={setValues}
              onAsk={async (text) => {
                const res = await callAction(() => quickPostPrepare({ text }));
                if (!res.ok || !res.data || res.data.kind === "reply") return false;
                const d = res.data;
                if (d.kind === "options") setFlow((f) => (f ? { ...f, screen: "options", question: d.question, groups: d.groups } : f));
                else if (d.form.profession) setValues({ profession: d.form.profession });
                else return false;
                return true;
              }}
              onPreview={(preview) => setFlow((f) => (f ? { ...f, preview, screen: "preview" } : f))}
              errorText={errorText}
            />
          ) : flow.preview ? (
            <PreviewSheet
              preview={flow.preview}
              onEdit={() => goScreen("form")}
              onPublish={publish}
              busy={publishing}
              aiImage={imageEnabled && flow.preview.loggedIn ? { value: image, onChange: setImage } : null}
            />
          ) : null
        ) : null}
      </Dialog>
    </div>
  );
}

function Assistant({ children, busy, className }: { children: ReactNode; busy?: boolean; className?: string }) {
  return (
    <div className="ai-bubble-in flex items-start gap-3">
      <AiAvatar size="sm" busy={busy} className="mt-1" />
      <div className={cn("min-w-0 rounded-2xl rounded-tl-md bg-secondary px-4 py-3 text-base leading-relaxed", className)}>{children}</div>
    </div>
  );
}

function Dots({ text }: { text: string }) {
  return (
    <p className="inline-flex items-center gap-3 text-muted-foreground" role="status">
      <span className="ai-dots text-primary-ink" aria-hidden>
        <span />
        <span />
        <span />
      </span>
      <span className="text-sm font-semibold">{text}</span>
    </p>
  );
}

function Composer({ onSend, busy, hydrated }: { onSend: (text: string) => boolean; busy: boolean; hydrated: boolean }) {
  const { t } = useT();
  const [text, setText] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
  }, [text]);
  const send = () => {
    if (onSend(text)) setText("");
    else if (!text.trim()) ref.current?.focus();
  };
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send();
    }
  };
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        send();
      }}
      className="space-y-1.5"
      data-state={busy ? "processing" : "idle"}
      data-hydrated={hydrated ? "" : undefined}
    >
      <div className="flex items-end gap-1.5 rounded-2xl border border-input bg-card p-1.5 transition-colors focus-within:border-primary focus-within:ring-2 focus-within:ring-ring/25">
        <label htmlFor="ai-post-text" className="sr-only">
          {t("easy.post_ai.placeholder")}
        </label>
        <textarea
          ref={ref}
          id="ai-post-text"
          rows={1}
          value={text}
          autoFocus
          onChange={(e) => setText(e.target.value.slice(0, MESSAGE_MAX_CHARS))}
          onKeyDown={onKeyDown}
          maxLength={MESSAGE_MAX_CHARS}
          enterKeyHint="send"
          placeholder={t("easy.post_ai.placeholder")}
          className="min-h-12 min-w-0 flex-1 resize-none overflow-hidden bg-transparent px-2.5 py-3 text-base leading-6 text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0"
        />
        <button type="submit" disabled={busy} aria-label={t("easy.finder.submit")} className="press relative flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground hover:bg-primary-hover disabled:opacity-50">
          <ArrowUp className="size-5" aria-hidden />
        </button>
      </div>
    </form>
  );
}

/** "Aynan qanday o'qituvchisiz?" — guruhlangan katta variantlar */
function OptionsSheet({ flow, onPick }: { flow: Flow; onPick: (p: PostChoice) => void }) {
  const { t } = useT();
  return (
    <Sheet title={flow.question ?? t("easy.post_ai.which_one")} description={t("easy.post_ai.which_desc")} icon={<AiAvatar />} data-ai-post-options>
      <div className="space-y-5 pt-1">
        {flow.groups.map((g, gi) => (
          <section key={g.title ?? `g${gi}`} className="space-y-2" aria-label={g.title ?? undefined}>
            {g.title ? <h3 className="text-sm font-bold text-muted-foreground">{g.title}</h3> : null}
            <ul className="grid gap-2 sm:grid-cols-2">
              {g.items.map((p) => (
                <li key={p.id} className="flex">
                  <button
                    type="button"
                    onClick={() => onPick(p)}
                    aria-pressed={flow.values.profession?.id === p.id}
                    className={cn(
                      "press flex min-h-12 w-full items-center justify-between gap-2 rounded-xl border px-4 py-2.5 text-left text-base font-semibold",
                      flow.values.profession?.id === p.id ? "border-primary bg-primary-soft text-primary-ink" : "border-border bg-card hover:border-primary/50",
                    )}
                    data-ai-post-option
                  >
                    <span className="min-w-0 [overflow-wrap:anywhere]">{p.name}</span>
                    <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </Sheet>
  );
}

type Errors = Partial<Record<"profession" | "firstName" | "region" | "experience" | "phone" | "phone2" | "form", string>>;

function FormSheet({
  flow,
  setValues,
  onAsk,
  onPreview,
  errorText,
}: {
  flow: Flow;
  setValues: (patch: Partial<Values>) => void;
  onAsk: (text: string) => Promise<boolean>;
  onPreview: (p: PostPreview) => void;
  errorText: (code: string) => string;
}) {
  const { t } = useT();
  const v = flow.values;
  const form = flow.form;
  const [editing, setEditing] = useState(!v.profession);
  const [typed, setTyped] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [pending, setPending] = useState(false);
  const formId = "ai-post-form";
  const districts = v.regionId ? (form.districts[v.regionId] ?? []) : [];

  const find = async () => {
    const text = typed.replace(/\s+/g, " ").trim();
    if (text.length < 2) return setErrors({ profession: t("easy.post_ai.profession_missing") });
    setPending(true);
    const ok = await onAsk(text);
    setPending(false);
    if (!ok) return setErrors({ profession: t("easy.post_ai.profession_unclear") });
    setErrors({});
    setEditing(false);
    setTyped("");
  };

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    if (editing && typed.trim()) return find();
    const err: Errors = {};
    if (!v.profession) err.profession = t("easy.post_ai.profession_missing");
    if (v.firstName.trim().length < 2) err.firstName = t("easy.post_ai.need_name");
    if (!v.regionId) err.region = t("easy.post_ai.need_region");
    if (!v.experience) err.experience = t("easy.post_ai.need_experience");
    // telefon majburiy va qo'lda yoziladi; ikkinchisi — yozila boshlangan bo'lsa, to'liq bo'lishi kerak
    if (!normalizePhone(v.phone)) err.phone = t("easy.post_ai.need_phone");
    if (v.phone2 !== null && v.phone2.replace(/\D/g, "").length > 3 && !normalizePhone(v.phone2)) err.phone2 = t("easy.post_ai.need_phone");
    const answers = toAnswers(v);
    if (Object.keys(err).length || !answers) return setErrors(err);
    setErrors({});
    setPending(true);
    const res = await callAction(() => quickPostPreview(answers));
    setPending(false);
    if (!res.ok || !res.data) return setErrors({ form: errorText(res.ok ? "generic" : res.error) });
    onPreview(res.data);
  };

  const chip = (selected: boolean) =>
    cn(
      "press inline-flex min-h-12 items-center rounded-full border px-4 text-base font-semibold",
      selected ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground hover:border-primary/50",
    );
  const label = "text-base font-bold";
  const err = (m?: string, id?: string) =>
    m ? (
      <p id={id} className="text-sm font-semibold text-destructive" role="alert">
        {m}
      </p>
    ) : null;

  return (
    <Sheet
      title={t("easy.post_ai.form_title")}
      description={t("easy.post_ai.form_desc")}
      icon={<AiAvatar />}
      onOpenAutoFocus={(e) => e.preventDefault()}
      data-ai-post-form
      footer={
        <div className="space-y-2">
          {err(errors.form)}
          <Button type="submit" form={formId} size="lg" fullWidth className="brand-fill text-base shadow-glow" loading={pending} disabled={pending} data-ai-post-confirm>
            <BadgeCheck className="size-5" aria-hidden /> {t("easy.post_ai.confirm")}
          </Button>
        </div>
      }
    >
      <form id={formId} onSubmit={submit} className="space-y-5 pt-1" noValidate>
        <div className="space-y-1.5">
          <label htmlFor={`${formId}-p`} className={label}>
            {t("easy.post_ai.q_profession")}
          </label>
          {!editing && v.profession ? (
            <div className="flex min-h-12 items-center gap-3 rounded-xl border border-primary/40 bg-primary-soft px-3 py-2" data-ai-post-profession>
              <BriefcaseBusiness className="size-5 shrink-0 text-primary-ink" aria-hidden />
              <span id={`${formId}-p`} className="min-w-0 flex-1 text-base font-bold text-primary-ink [overflow-wrap:anywhere]">
                {v.profession.name}
              </span>
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="press inline-flex min-h-11 shrink-0 items-center gap-1 rounded-lg px-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
                data-ai-post-profession-change
              >
                <Pencil className="size-4" aria-hidden /> {t("easy.post_ai.profession_change")}
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Input
                id={`${formId}-p`}
                value={typed}
                onChange={(e) => setTyped(e.target.value.slice(0, 120))}
                placeholder={t("easy.post_ai.profession_placeholder")}
                enterKeyHint="search"
                invalid={!!errors.profession}
                className="min-w-0 flex-1"
                data-ai-post-profession-input
              />
              <Button type="button" variant="outline" className="h-11 shrink-0 text-base" onClick={find} disabled={pending} data-ai-post-find>
                <Search className="size-5" aria-hidden /> {t("easy.post_ai.profession_find")}
              </Button>
            </div>
          )}
          {err(errors.profession)}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor={`${formId}-fn`} className={label}>
              {t("easy.post_ai.q_first_name")}
            </label>
            <Input id={`${formId}-fn`} value={v.firstName} autoComplete="given-name" onChange={(e) => setValues({ firstName: e.target.value.slice(0, 60) })} invalid={!!errors.firstName} data-ai-post-first-name />
            {err(errors.firstName)}
          </div>
          <div className="space-y-1.5">
            <label htmlFor={`${formId}-ln`} className={label}>
              {t("easy.post_ai.q_last_name")} <span className="text-sm font-normal text-muted-foreground">({t("easy.post_ai.optional")})</span>
            </label>
            <Input id={`${formId}-ln`} value={v.lastName} autoComplete="family-name" onChange={(e) => setValues({ lastName: e.target.value.slice(0, 60) })} data-ai-post-last-name />
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor={`${formId}-r`} className={label}>
            {t("easy.post_ai.q_region")}
          </label>
          <Select
            id={`${formId}-r`}
            value={v.regionId}
            onChange={(e) => setValues({ regionId: e.target.value, districtId: "" })}
            options={form.regions}
            placeholder={t("easy.post_ai.region_pick")}
            invalid={!!errors.region}
            data-ai-post-region
          />
          {err(errors.region)}
        </div>
        {districts.length ? (
          <div className="space-y-1.5">
            <label htmlFor={`${formId}-d`} className={label}>
              {t("easy.post_ai.q_district")}
            </label>
            <Select id={`${formId}-d`} value={v.districtId} onChange={(e) => setValues({ districtId: e.target.value })} options={[{ value: "", label: t("easy.post_ai.district_any") }, ...districts]} data-ai-post-district />
          </div>
        ) : null}

        <fieldset className="space-y-2">
          <legend className={label}>{t("easy.post_ai.q_experience")}</legend>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t("easy.post_ai.q_experience")} data-ai-post-experience>
            {POST_EXPERIENCES.map((x) => (
              <button key={x} type="button" role="radio" aria-checked={v.experience === x} onClick={() => setValues({ experience: x })} className={chip(v.experience === x)} data-exp={x}>
                {t(`easy.worker.exp.${x}`)}
              </button>
            ))}
          </div>
          {err(errors.experience)}
        </fieldset>

        {/* ega (2026-11-17): raqam qo'lda yoziladi, majburiy; hisobdagi raqam oldindan qo'yilmaydi; "+ Yana raqam" — ikkinchisi */}
        <div className="space-y-1.5" data-ai-post-phones>
          <label htmlFor="phone" className={label}>
            {t("easy.post_ai.q_phone")}
          </label>
          <PhoneInput id="phone" value={v.phone} onChange={(p) => setValues({ phone: p })} invalid={!!errors.phone} describedBy="ai-post-phone-note" />
          {err(errors.phone)}
          {v.phone2 === null ? (
            <button
              type="button"
              onClick={() => setValues({ phone2: "+998 " })}
              className="press inline-flex min-h-11 items-center gap-1.5 rounded-lg px-1 text-base font-semibold text-primary-ink hover:underline"
              data-ai-post-add-phone
            >
              <Plus className="size-5" aria-hidden /> {t("easy.post_ai.add_phone")}
            </button>
          ) : (
            <div className="space-y-1.5 pt-1" data-ai-post-phone2>
              <label htmlFor="phone2" className={label}>
                {t("easy.post_ai.q_phone2")} <span className="text-sm font-normal text-muted-foreground">({t("easy.post_ai.optional")})</span>
              </label>
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <PhoneInput id="phone2" value={v.phone2} onChange={(p) => setValues({ phone2: p })} invalid={!!errors.phone2} />
                </div>
                <button
                  type="button"
                  onClick={() => setValues({ phone2: null })}
                  aria-label={t("easy.post_ai.remove_phone")}
                  title={t("easy.post_ai.remove_phone")}
                  className="press flex size-14 shrink-0 items-center justify-center rounded-2xl border border-border text-muted-foreground hover:bg-secondary hover:text-foreground"
                  data-ai-post-remove-phone
                >
                  <X className="size-5" aria-hidden />
                </button>
              </div>
              {err(errors.phone2)}
            </div>
          )}
          <p id="ai-post-phone-note" className="flex items-start gap-1.5 text-sm text-muted-foreground">
            <Phone className="mt-0.5 size-4 shrink-0" aria-hidden />
            {form.loggedIn ? t("easy.post_ai.phone_note") : `${t("easy.post_ai.phone_note")} ${t("easy.post_ai.phone_login_note")}`}
          </p>
        </div>
      </form>
    </Sheet>
  );
}

/** "Sizning e'loningiz shunday ko'rinadi" — joylanadigan matnning o'zi */
function PreviewSheet({
  preview,
  onEdit,
  onPublish,
  busy,
  aiImage,
}: {
  preview: PostPreview;
  onEdit: () => void;
  onPublish: () => void;
  busy: boolean;
  /** AI e'lon rasmi — joylashdan oldin (kirgan foydalanuvchiga, sozlangan bo'lsa) */
  aiImage: { value: DraftImage | null; onChange: (v: DraftImage | null) => void } | null;
}) {
  const { t } = useT();
  const [image, setImage] = useState<string | null>(null);
  const id = preview.answers.professionId;
  useEffect(() => {
    let alive = true;
    fetch(`/api/profession-images?ids=${id}`)
      .then((r) => r.json() as Promise<{ images?: Record<string, string> }>)
      .then((d) => alive && setImage(d.images?.[id] ?? null))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [id]);
  return (
    <Sheet
      title={t("easy.post_ai.preview_title")}
      description={t("easy.post_ai.preview_desc")}
      icon={<AiAvatar />}
      onOpenAutoFocus={(e) => e.preventDefault()}
      data-ai-post-preview
      footer={
        <div className="space-y-2">
          {!preview.loggedIn ? <p className="text-sm text-muted-foreground">{t("easy.post_ai.login_first")}</p> : null}
          <div className="grid grid-cols-[auto_1fr] gap-2">
            <Button type="button" variant="outline" size="lg" className="text-base" onClick={onEdit} disabled={busy} data-ai-post-edit>
              <Pencil className="size-5" aria-hidden /> {t("easy.post_ai.edit")}
            </Button>
            <Button type="button" size="lg" className="brand-fill text-base shadow-glow" onClick={onPublish} loading={busy} disabled={busy} data-ai-post-publish>
              {t("easy.post_ai.publish")}
            </Button>
          </div>
        </div>
      }
    >
      <article className="overflow-hidden rounded-2xl border border-border bg-card shadow-card" data-ai-post-card>
        <div className="flex gap-3 p-4">
          <ProfessionImage url={image} name={preview.profession} className="size-16 shrink-0" />
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-extrabold leading-snug [overflow-wrap:anywhere]">{preview.profession}</h3>
            <p className="text-base font-semibold">{preview.name}</p>
            <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
              <MapPin className="size-4 shrink-0" aria-hidden /> {preview.place}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 px-4">
          <span className="inline-flex min-h-8 items-center rounded-full bg-primary-soft px-3 text-sm font-semibold text-primary-ink">{t(`easy.worker.exp.${preview.answers.experience}`)}</span>
        </div>
        <p className="px-4 pb-3 pt-3 text-base leading-relaxed" data-ai-post-about>
          {preview.about}
        </p>
        {/* raqamning o'zi ekranda ko'rsatilmaydi — faqat "e'londa ko'rinadi" (bitta yoki ikkala raqam) */}
        <p className="flex items-center gap-2 border-t border-border px-4 py-3 text-sm text-muted-foreground" data-ai-post-preview-phones>
          <Phone className="size-4 shrink-0" aria-hidden /> {t(preview.answers.phone2 ? "easy.post_ai.preview_phones" : "easy.post_ai.preview_phone")}
        </p>
      </article>
      {aiImage ? (
        <div className="mt-3">
          <ListingImageDraft entity="worker" professionId={preview.answers.professionId} title={preview.profession} value={aiImage.value} onChange={aiImage.onChange} />
        </div>
      ) : null}
    </Sheet>
  );
}

/** Joylash natijasi — faqat haqiqiy holat */
function Outcome({ outcome, onEdit, onAgain }: { outcome: PostOutcome; onEdit: () => void; onAgain: () => void }) {
  const { t } = useT();
  const state = outcome.info.state;
  const header = (
    <header className="sticky top-0 z-20 border-b border-border bg-card" style={{ paddingTop: "var(--safe-top)" }}>
      <div className="mx-auto flex min-h-16 w-full max-w-3xl items-center gap-2 px-2 py-2 sm:px-4">
        <BackLink fallback="/" label={t("easy.wizard.back")} className="press flex size-11 shrink-0 items-center justify-center rounded-xl text-foreground hover:bg-secondary">
          <ChevronLeft className="size-6" aria-hidden />
        </BackLink>
        <p className="truncate text-lg font-extrabold">{t("easy.post_ai.page_title")}</p>
      </div>
    </header>
  );
  let body: ReactNode;
  if (state === "listed") {
    body = (
      <PublishResult
        tone="success"
        title={t("easy.post_ai.done_title")}
        description={t("easy.post_ai.done_desc")}
        actions={[
          { label: t("easy.post_ai.done_view"), href: `/listing/${outcome.workerId}`, primary: true },
          { label: t("easy.post_ai.done_matches"), href: outcome.matchesHref },
        ]}
      >
        <div className="mt-6 space-y-3" data-ai-post-notify>
          <p className="flex items-start gap-2 text-base">
            <BadgeCheck className="mt-0.5 size-5 shrink-0 text-success" aria-hidden /> {t("easy.post_ai.done_notify")}
          </p>
          <AlertToggle role="worker" initialStatus={outcome.alert} defaults={{ professionNodeId: outcome.professionId, regionId: outcome.regionId }} compact />
        </div>
      </PublishResult>
    );
  } else if (state === "payment_required" || state === "saved") {
    body = (
      <PublishResult
        tone="payment"
        title={t("easy.post_ai.pay_title")}
        description={t("easy.post_ai.pay_desc")}
        payment={state === "payment_required" ? { purpose: "worker_listing", targetId: outcome.workerId } : undefined}
        actions={[{ label: t("easy.post_ai.pay_open"), href: "/cabinet" }]}
      />
    );
  } else {
    body = (
      <ModerationOutcome
        entity="worker"
        id={outcome.workerId}
        info={outcome.info}
        fieldLabels={{
          name: t("easy.post_ai.q_first_name"),
          title: t("easy.post_ai.q_profession"),
          profession: t("easy.post_ai.q_profession"),
          description: t("easy.post_ai.q_profession"),
          experience: t("easy.post_ai.q_experience"),
          photo: t("easy.moderation.photo"),
        }}
        onEdit={onEdit}
      />
    );
  }
  return (
    <div className="flex min-h-dvh flex-col bg-background" data-ai-post data-ai-post-outcome={state}>
      {header}
      <main className="mx-auto w-full max-w-3xl flex-1">{body}</main>
      <div className="mx-auto w-full max-w-3xl px-4 pb-8">
        <Button type="button" variant="ghost" className="h-12 w-full text-base" onClick={onAgain} data-ai-post-again>
          <RotateCcw className="size-5" aria-hidden /> {t("easy.post_ai.again")}
        </Button>
      </div>
    </div>
  );
}
