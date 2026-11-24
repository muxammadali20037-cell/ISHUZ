"use client";

import { ListingImageDraft } from "@/features/listing-image/components/listing-image-draft";
import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, Check, ChevronLeft, RotateCcw, Sparkles } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { callAction } from "@/lib/action-call";
import { formatMoneyShort, formatPhone, normalizePhone } from "@/lib/format";
import { isCityRegion } from "@/lib/geo/city";
import type { Category, District, Region } from "@/lib/reference";
import type { PickedProfession } from "@/features/professions/types";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { AiAvatar } from "@/components/shared/ai-avatar";
import { cn } from "@/lib/utils";
import type { ProfessionOption } from "../chat-actions";
import { vacancyGuideTurn, type GuideParse } from "../guide-actions";
import { SALARY_PRESETS, composeDescription, extraKeyOf, guideProgress, guideRelevant, nextGuideStep, type GuideStep } from "../guide-logic";
import {
  AGE_MAX,
  AGE_MIN,
  AGE_PRESETS,
  EXTRA_OPTIONS,
  HOURS_PRESETS,
  TIME_RE,
  ageLabel,
  extraKeysFor,
  extraLines,
  extrasFromName,
  hoursLabel,
  pickExtras,
  type ExtraKey,
  type ProfessionContext,
} from "../requirements";
import { VACANCY_NOTE_PRESETS, formatNotes, notesBlock, withNotes } from "../notes";
import { parseMoney } from "../money";
import { EMPTY_PLACE, SCHEDULES, SIMPLE_EMPLOYER_TYPES, VACANCY_EXPERIENCE, type PostViewer, type VacancyDraft } from "../types";
import { MoneyInput, PhoneInput, bigInput } from "./inputs";
import { PhonePublicNote } from "./phone-public-note";
import { placeLabel } from "./region-picker";
import { FieldError, ReviewRow } from "./wizard-frame";

/**
 * "AI bilan oson joylash" (ish beruvchi, 2026-11-16). Ega: "menga shunaqa kerak desa — ekranga savol chiqsin, tanlab-tanlab
 * sen bergan variantni o'tkazsin, yozuvlar kam va tushunarli bo'lsin".
 *  1) bitta gap ("Chilonzordagi kafega oshpaz kerak, 5 mln") yoki tayyor misol bosiladi;
 *  2) tushunilmagan narsa ekranda BITTADAN so'raladi — katta variant tugmalari bilan (kasb, joy, maosh, grafik, tajriba…);
 *  3) oxirida hammasi bir ekranda: "O'zgartirish" yoki "E'lonni joylash". Hech narsa o'zi joylanmaydi.
 * Javoblar oddiy vakansiya qoralamasiga yoziladi (useDraft) — "Oddiy forma"ga o'tilsa ham yo'qolmaydi.
 */
export function VacancyGuide({
  regions,
  districts,
  categories,
  quick,
  draft,
  update,
  viewer,
  dailyAllowed,
  busy,
  pending,
  error,
  onPublish,
  onClassic,
  initialSentence = "",
  imageEnabled = false,
}: {
  /** AI e'lon rasmi sozlangan — oxirgi ekranda joylashdan oldin rasm (kirgan foydalanuvchiga) */
  imageEnabled?: boolean;
  /** asosiy chatda yozilgan birinchi gap ("Oshpaz kerak, Yunusobod") — darhol shu bilan boshlanadi */
  initialSentence?: string;
  regions: Region[];
  districts: District[];
  /** kasb sohasi (kategoriya slug) — kasbga xos savollar uchun (haydovchi, kuryer, usta…) */
  categories: Category[];
  /** kasb savolidagi tez variantlar (sotuvchi, oshpaz, haydovchi…) */
  quick: ProfessionOption[];
  draft: VacancyDraft;
  update: (patch: Partial<VacancyDraft>) => void;
  viewer: PostViewer;
  dailyAllowed: boolean;
  busy: boolean;
  pending: boolean;
  error: string | null;
  onPublish: () => void;
  onClassic: () => void;
}) {
  const { t, name, tEnum, locale } = useT();
  const [started, setStarted] = useState(false);
  const [sentence, setSentence] = useState("");
  const [asked, setAsked] = useState<ReadonlySet<GuideStep>>(new Set());
  /** javob berilgan savollar ketma-ketligi — "Orqaga" shu bo'yicha */
  const [history, setHistory] = useState<GuideStep[]>([]);
  const [options, setOptions] = useState<ProfessionOption[]>([]);
  /** shu savolda matn kiritish ochiq ("Boshqa kasb", "Boshqa summa", tavsifni o'zgartirish) */
  const [typing, setTyping] = useState<GuideStep | null>(null);
  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);
  /** "Izoh" savolida belgilangan tayyor variantlar */
  const [notePicks, setNotePicks] = useState<string[]>([]);
  /** "Boshqa yosh" / "Boshqa vaqt" — ikki maydon */
  const [pair, setPair] = useState<[string, string]>(["", ""]);
  const [thinking, start] = useTransition();

  /** kasb sohasi va nomlari → shu kasbga xos savollar (ega, 2026-11-24: "kasbga qarab nima kerak bo'lsa — shu so'ralsin") */
  const contextOf = (p: PickedProfession | null, custom = draft.custom): ProfessionContext => {
    const last = p?.trail.at(-1);
    const categoryId = p?.categoryId ?? custom?.categoryId ?? null;
    return {
      category: categories.find((c) => c.id === categoryId)?.slug ?? null,
      names: last ? [last.name_uz, last.name_ru, last.name_en ?? ""].filter(Boolean) : custom ? [custom.text] : [],
    };
  };
  const keys: ExtraKey[] = extraKeysFor(contextOf(draft.profession));
  /** kasb tanlandi: nomidan ("C toifa haydovchi") va birinchi gapdan ("o'z mashinasi bilan") tushunilgan javoblar */
  const professionPatch = (p: PickedProfession, said: string): Partial<VacancyDraft> => {
    const ctx = contextOf(p, null);
    return { profession: p, custom: null, extras: { ...pickExtras(said, extraKeysFor(ctx)), ...extrasFromName(ctx) } };
  };

  const step = started ? nextGuideStep(draft, asked, keys) : null;
  const progress = guideProgress(draft, asked, keys);
  const professionName = draft.profession ? name(draft.profession.trail.at(-1)!) : (draft.custom?.text ?? "");
  const region = regions.find((r) => r.id === draft.place.regionId) ?? null;
  const daily = draft.salaryType === "daily";
  const isPerson = draft.employerType === "person";

  const errorText = (code: string) => {
    const k = `easy.errors.${code}`;
    const v = t(k);
    return v === k ? t("easy.errors.generic") : v;
  };

  const mark = (s: GuideStep) => {
    setAsked((a) => new Set(a).add(s));
    setHistory((h) => [...h, s]);
    setTyping(null);
    setText("");
    setPair(["", ""]);
    setErr(null);
    setOptions([]);
  };
  const answer = (s: GuideStep, patch: Partial<VacancyDraft>) => {
    update(patch);
    mark(s);
  };

  /** javobni bekor qilish (shu savol qayta chiqadi) */
  const undo = (s: GuideStep) => {
    const patch: Partial<VacancyDraft> = {};
    if (s === "profession") Object.assign(patch, { profession: null, custom: null, title: "", extras: undefined });
    const x = extraKeyOf(s);
    if (x) {
      const rest = { ...draft.extras };
      delete rest[x];
      patch.extras = rest;
      // "Masofadan" tanlangan bo'lsa — joy ham qayta so'raladi
      if (x === "format" && draft.place.remote) patch.place = EMPTY_PLACE;
    }
    if (s === "hours") patch.hours = undefined;
    if (s === "gender") patch.gender = undefined;
    if (s === "age") patch.age = undefined;
    if (s === "region") patch.place = EMPTY_PLACE;
    if (s === "district") patch.place = { ...draft.place, districtId: null, districtChosen: false };
    if (s === "salary") Object.assign(patch, { salaryFrom: "", salaryTo: "", negotiable: false });
    if (s === "schedule") patch.schedule = "";
    if (s === "employerType") patch.employerType = null;
    if (s === "orgName") patch.orgName = "";
    if (s === "phone") patch.phone = "+998 ";
    if (s === "notes") Object.assign(patch, { notes: undefined, description: "" });
    update(patch);
    setAsked((a) => {
      const n = new Set(a);
      n.delete(s);
      // matn yig'ilgan javoblardan tuziladi — kasb, joy, grafik yoki tajriba o'zgarsa, qayta ko'rsatiladi
      if (["profession", "region", "district", "schedule", "experience", "notes"].includes(s) || extraKeyOf(s)) n.delete("description");
      return n;
    });
    setHistory((h) => h.filter((x) => x !== s));
    setTyping(null);
    setText("");
    setPair(["", ""]);
    setErr(null);
  };

  const back = () => {
    const last = history.at(-1);
    if (last) undo(last);
    else if (started) {
      setStarted(false);
      setOptions([]);
      setTyping(null);
    }
  };

  /** birinchi gap: avvalgi tushunilganlar tozalanadi, keyin yangisi qo'yiladi (ish beruvchi turi, nomi, telefon — profildan qoladi) */
  const begin = (raw: string) => {
    const value = raw.replace(/\s+/g, " ").trim();
    if (value.length < 2 || thinking) return;
    setErr(null);
    start(async () => {
      const res = await callAction(() => vacancyGuideTurn({ field: "start", text: value, locale }));
      if (!res.ok || !res.data) {
        setErr(errorText(res.ok ? "generic" : res.error));
        return;
      }
      const p: GuideParse = res.data;
      const pay = p.daily && dailyAllowed ? "daily" : "monthly";
      update({
        ...(p.profession ? professionPatch(p.profession, value) : { profession: null, extras: undefined }),
        custom: null,
        title: p.title ?? "",
        place: p.place ?? EMPTY_PLACE,
        salaryFrom: p.salaryFrom ? String(p.salaryFrom) : "",
        salaryTo: p.salaryTo ? String(p.salaryTo) : "",
        negotiable: !!p.negotiable,
        ...(dailyAllowed ? { salaryType: pay } : {}),
        schedule: p.schedule ?? "",
        experienceMonths: p.experienceMonths ?? 0,
        description: p.description ?? "",
        // jinsi, yosh, ish vaqti — gapda aytilgan bo'lsa qayta so'ralmaydi
        gender: p.gender,
        age: p.age,
        hours: p.hours,
        ...(p.employerType && !draft.employerType ? { employerType: p.employerType } : {}),
        ...(p.orgName && draft.orgName.trim().length < 2 ? { orgName: p.orgName } : {}),
        source: "ai",
      });
      const known = new Set<GuideStep>();
      if (p.experienceMonths !== undefined) known.add("experience");
      setAsked(known);
      setHistory([]);
      setOptions(p.professionOptions ?? []);
      setSentence(value);
      setTyping(null);
      setText("");
      setStarted(true);
    });
  };

  // asosiy chatdan kelgan gap (?q=): qoralama tiklangach bir marta boshlanadi; manzildan olib tashlanadi
  const auto = useRef(false);
  useEffect(() => {
    if (auto.current || busy || started || initialSentence.trim().length < 2) return;
    auto.current = true;
    window.history.replaceState(null, "", `${window.location.pathname}?ai=1`);
    begin(initialSentence);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- faqat birinchi marta
  }, [busy, started, initialSentence]);

  const pickProfession = (o: ProfessionOption) => {
    if (thinking) return;
    setErr(null);
    start(async () => {
      const res = await callAction(() => vacancyGuideTurn({ field: "profession", text: o.name_uz, nodeId: o.id, locale }));
      if (!res.ok || !res.data?.profession) {
        setErr(errorText(res.ok ? "generic" : res.error));
        return;
      }
      answer("profession", professionPatch(res.data.profession, sentence));
    });
  };

  const typeProfession = (raw: string) => {
    const value = raw.trim();
    if (value.length < 2 || thinking) return;
    setErr(null);
    start(async () => {
      const res = await callAction(() => vacancyGuideTurn({ field: "profession", text: value, locale }));
      if (!res.ok || !res.data) {
        setErr(errorText(res.ok ? "generic" : res.error));
        return;
      }
      if (res.data.profession) answer("profession", professionPatch(res.data.profession, `${sentence} ${value}`));
      else if (res.data.professionOptions?.length) {
        setOptions(res.data.professionOptions);
        setTyping(null);
        setText("");
      } else setErr(t("easy.vguide.not_understood"));
    });
  };

  // ---------------------------------------------------------------------------------------------------- ekranlar

  /** kasbga xos javob matni ("C toifa", "Piyoda", "Bir martalik ish") */
  const extraOption = (k: ExtraKey, v: string) => (k === "license" ? t("easy.vguide.x.license.option", { value: v }) : t(`easy.vguide.x.${k}.${v}`));
  const genderText = (g: NonNullable<VacancyDraft["gender"]>) => (g === "any" ? t("easy.vguide.any") : t(`easy.vguide.${g}`));
  const ageText = (a: NonNullable<VacancyDraft["age"]>) => ageLabel(a, t) ?? t("easy.vguide.any");
  const hoursText = (h: VacancyDraft["hours"]) => (h ? hoursLabel(h) : t("easy.vacancy.negotiable"));
  const piece = keys.includes("pay") && draft.extras?.pay === "piece";

  const understood = [
    professionName,
    draft.place.regionId || draft.place.remote ? placeLabel(draft.place, regions, districts, name, t) : null,
    draft.negotiable ? t("easy.vacancy.negotiable") : parseMoney(draft.salaryFrom) ? `${formatMoneyShort(parseMoney(draft.salaryFrom), locale)}${daily ? ` · ${t("easy.vacancy.pay_daily").toLowerCase()}` : ""}` : null,
    draft.schedule ? tEnum("work_schedule", draft.schedule) : null,
    ...keys.map((k) => {
      const v = draft.extras?.[k];
      return v && v !== "any" ? extraOption(k, v) : null;
    }),
    draft.hours ? hoursLabel(draft.hours) : null,
    draft.gender && draft.gender !== "any" ? t(`easy.vguide.${draft.gender}`) : null,
    draft.age ? ageLabel(draft.age, t) : null,
  ].filter((x): x is string => !!x);

  const choices = (items: { key: string; label: string; run: () => void; on?: boolean; wide?: boolean }[]) => (
    <ul className="grid grid-cols-2 gap-2" data-guide-choices>
      {items.map((c) => (
        <li key={c.key} className={cn("flex", c.wide && "col-span-2")}>
          <button
            type="button"
            onClick={c.run}
            disabled={thinking}
            data-guide-choice={c.key}
            className={cn(
              "press flex min-h-14 w-full items-center justify-center rounded-2xl border-2 px-3 py-2 text-center text-base font-semibold leading-snug [overflow-wrap:anywhere] disabled:opacity-60",
              c.on ? "border-primary bg-primary-soft text-primary-ink" : "border-border bg-card hover:border-primary/60",
            )}
          >
            {c.label}
          </button>
        </li>
      ))}
    </ul>
  );

  const textStep = (opts: { label: string; value: string; onChange: (v: string) => void; onSubmit: () => void; disabled?: boolean; input?: ReactNode }) => (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!opts.disabled) opts.onSubmit();
      }}
    >
      {opts.input ?? <Input value={opts.value} onChange={(e) => opts.onChange(e.target.value.slice(0, 120))} aria-label={opts.label} placeholder={opts.label} autoFocus className={bigInput} data-guide-input />}
      <Button type="submit" size="xl" fullWidth loading={thinking} disabled={opts.disabled} data-guide-next>
        {t("easy.vguide.next")} {!thinking ? <ArrowRight className="size-5" aria-hidden /> : null}
      </Button>
    </form>
  );

  let title = "";
  let body: ReactNode = null;

  if (!started) {
    title = t("easy.vguide.intro_title");
    body = (
      <div className="space-y-4">
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            begin(text);
          }}
        >
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, 800))}
            placeholder={t("easy.vguide.intro_placeholder")}
            aria-label={t("easy.vguide.intro_hint")}
            autoFocus
            rows={3}
            className="min-h-[120px] rounded-2xl text-lg"
            data-guide-sentence
          />
          <Button type="submit" size="xl" fullWidth loading={thinking} disabled={text.trim().length < 2} data-guide-start>
            {!thinking ? <Sparkles className="size-5" aria-hidden /> : null} {thinking ? t("easy.vguide.thinking") : t("easy.vguide.start")}
          </Button>
        </form>
        {choices(["1", "2", "3", "4"].map((k) => ({ key: `ex${k}`, label: t(`easy.vguide.examples.${k}`), run: () => (setText(t(`easy.vguide.examples.${k}`)), begin(t(`easy.vguide.examples.${k}`))) })))}
      </div>
    );
  } else if (step === "profession") {
    title = options.length ? t("easy.vguide.q.profession_pick") : t("easy.vguide.q.profession");
    const list = options.length ? options : quick;
    body =
      typing === "profession" ? (
        textStep({ label: t("easy.vguide.profession_input"), value: text, onChange: setText, onSubmit: () => typeProfession(text), disabled: text.trim().length < 2 })
      ) : (
        choices([
          ...list.map((o) => ({ key: o.id, label: name(o), run: () => pickProfession(o) })),
          { key: "other", label: t("easy.vguide.other_profession"), run: () => (setTyping("profession"), setText(""), setErr(null)), wide: list.length % 2 === 0 },
        ])
      );
  } else if (step && extraKeyOf(step)) {
    // kasbga xos savol (haydovchi — guvohnoma, mashina; kuryer — transport; IT — format; usta — doimiy/bir martalik; tikuvchi — ishbay)
    const k = extraKeyOf(step)!;
    title = t(`easy.vguide.q.${step}`);
    const opts = EXTRA_OPTIONS[k];
    body = choices(
      opts.map((v, i) => ({
        key: v,
        label: extraOption(k, v),
        run: () => answer(step, { extras: { ...draft.extras, [k]: v }, ...(k === "format" && v === "remote" ? { place: { regionId: null, districtId: null, districtChosen: true, remote: true } } : {}) }),
        wide: opts.length % 2 === 1 && i === opts.length - 1,
      })),
    );
  } else if (step === "region") {
    title = t("easy.vguide.q.region");
    body = choices([
      ...regions.map((r) => ({ key: r.id, label: name(r), run: () => answer("region", { place: { regionId: r.id, districtId: null, districtChosen: false, remote: false } }) })),
      { key: "remote", label: t("easy.location.remote"), run: () => answer("region", { place: { regionId: null, districtId: null, districtChosen: true, remote: true } }), wide: true },
    ]);
  } else if (step === "district") {
    title = t("easy.vguide.q.district");
    body = choices([
      { key: "whole", label: t(region && isCityRegion(region) ? "easy.location.whole_city" : "easy.location.whole_region"), run: () => answer("district", { place: { ...draft.place, districtId: null, districtChosen: true } }), wide: true },
      ...districts
        .filter((d) => d.region_id === region?.id)
        .map((d) => ({ key: d.id, label: name(d), run: () => answer("district", { place: { ...draft.place, districtId: d.id, districtChosen: true } }) })),
    ]);
  } else if (step === "salary") {
    title = daily ? t("easy.vguide.q.salary_daily") : piece ? t("easy.vguide.q.salary_piece") : t("easy.vguide.q.salary");
    const pay = dailyAllowed ? { salaryType: daily ? ("daily" as const) : ("monthly" as const) } : {};
    body =
      typing === "salary" ? (
        textStep({
          label: t("easy.vguide.amount_label"),
          value: text,
          onChange: setText,
          disabled: (parseMoney(text) ?? 0) < 10_000,
          onSubmit: () => answer("salary", { salaryFrom: String(parseMoney(text)), salaryTo: "", negotiable: false, ...pay }),
          input: <MoneyInput id="guide-amount" value={text} onChange={setText} placeholder={daily ? "200 000" : "5 000 000"} label={t("easy.vguide.amount_label")} />,
        })
      ) : (
        <div className="space-y-3">
          {choices([
            ...SALARY_PRESETS[daily ? "daily" : "monthly"].map((n) => ({ key: String(n), label: formatMoneyShort(n, locale), run: () => answer("salary", { salaryFrom: String(n), salaryTo: "", negotiable: false, ...pay }) })),
            { key: "negotiable", label: t("easy.vacancy.negotiable"), run: () => answer("salary", { salaryFrom: "", salaryTo: "", negotiable: true, ...pay }) },
            { key: "other", label: t("easy.vguide.other_amount"), run: () => (setTyping("salary"), setText("")) },
          ])}
          {dailyAllowed ? (
            <button
              type="button"
              onClick={() => update({ salaryType: daily ? "monthly" : "daily" })}
              className="inline-flex min-h-11 items-center gap-1.5 text-base font-semibold text-primary-ink hover:underline"
              data-guide-pay-switch
            >
              <RotateCcw className="size-4" aria-hidden /> {daily ? t("easy.vguide.pay_monthly") : t("easy.vguide.pay_daily")}
            </button>
          ) : null}
        </div>
      );
  } else if (step === "schedule") {
    title = t("easy.vguide.q.schedule");
    body = choices([
      ...SCHEDULES.map((s) => ({ key: s, label: tEnum("work_schedule", s), run: () => answer("schedule", { schedule: s }) })),
      { key: "any", label: t("easy.vguide.any"), run: () => answer("schedule", { schedule: "" }) },
    ]);
  } else if (step === "hours") {
    // ish vaqti — faqat kerak joyda (masofaviy, bir martalik, smenali ishda so'ralmaydi)
    title = t("easy.vguide.q.hours");
    const [from, to] = pair;
    body =
      typing === "hours" ? (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (TIME_RE.test(from) && TIME_RE.test(to) && from !== to) answer("hours", { hours: { from, to } });
          }}
          data-guide-hours-custom
        >
          <div className="grid grid-cols-2 gap-3">
            {([0, 1] as const).map((i) => (
              <label key={i} className="block">
                <span className="mb-1 block text-base font-semibold">{t(i === 0 ? "easy.vguide.time_from" : "easy.vguide.time_to")}</span>
                <Input type="time" step={900} value={pair[i]} onChange={(e) => setPair((p) => (i === 0 ? [e.target.value, p[1]] : [p[0], e.target.value]))} className={bigInput} data-guide-time={i === 0 ? "from" : "to"} />
              </label>
            ))}
          </div>
          <Button type="submit" size="xl" fullWidth disabled={!TIME_RE.test(from) || !TIME_RE.test(to) || from === to} data-guide-next>
            {t("easy.vguide.next")} <ArrowRight className="size-5" aria-hidden />
          </Button>
        </form>
      ) : (
        choices([
          ...HOURS_PRESETS.map((h) => ({ key: h.from, label: hoursLabel(h), run: () => answer("hours", { hours: h }) })),
          { key: "other", label: t("easy.vguide.other_time"), run: () => (setTyping("hours"), setPair(["09:00", "18:00"])) },
          { key: "negotiable", label: t("easy.vacancy.negotiable"), run: () => answer("hours", { hours: null }), wide: true },
        ])
      );
  } else if (step === "gender") {
    title = t("easy.vguide.q.gender");
    body = choices([
      { key: "male", label: t("easy.vguide.male"), run: () => answer("gender", { gender: "male" }) },
      { key: "female", label: t("easy.vguide.female"), run: () => answer("gender", { gender: "female" }) },
      { key: "any", label: t("easy.vguide.any"), run: () => answer("gender", { gender: "any" }), wide: true },
    ]);
  } else if (step === "age") {
    // aniq yosh emas — chegaralar (ega, 2026-11-24)
    title = t("easy.vguide.q.age");
    const lo = pair[0].trim() ? Number(pair[0]) : null;
    const hi = pair[1].trim() ? Number(pair[1]) : null;
    const ok = (n: number | null) => n === null || (Number.isInteger(n) && n >= AGE_MIN && n <= AGE_MAX);
    const valid = (lo !== null || hi !== null) && ok(lo) && ok(hi) && (lo === null || hi === null || hi >= lo);
    body =
      typing === "age" ? (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (valid) answer("age", { age: { min: lo, max: hi } });
          }}
          data-guide-age-custom
        >
          <div className="grid grid-cols-2 gap-3">
            {([0, 1] as const).map((i) => (
              <label key={i} className="block">
                <span className="mb-1 block text-base font-semibold">{t(i === 0 ? "easy.vguide.age_from_input" : "easy.vguide.age_to_input")}</span>
                <Input
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={2}
                  value={pair[i]}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, "").slice(0, 2);
                    setPair((p) => (i === 0 ? [v, p[1]] : [p[0], v]));
                  }}
                  placeholder={i === 0 ? "18" : "35"}
                  className={bigInput}
                  data-guide-age={i === 0 ? "from" : "to"}
                />
              </label>
            ))}
          </div>
          {(pair[0].length === 2 || pair[1].length === 2) && !valid ? <p className="text-base text-destructive">{t("easy.vguide.age_invalid")}</p> : null}
          <Button type="submit" size="xl" fullWidth disabled={!valid} data-guide-next>
            {t("easy.vguide.next")} <ArrowRight className="size-5" aria-hidden />
          </Button>
        </form>
      ) : (
        choices([
          ...AGE_PRESETS.map((a) => ({ key: `${a.min}-${a.max}`, label: ageLabel(a, t)!, run: () => answer("age", { age: a }) })),
          { key: "other", label: t("easy.vguide.other_age"), run: () => (setTyping("age"), setPair(["", ""])) },
          { key: "any", label: t("easy.vguide.any"), run: () => answer("age", { age: { min: null, max: null } }) },
        ])
      );
  } else if (step === "experience") {
    title = t("easy.vguide.q.experience");
    body = choices(VACANCY_EXPERIENCE.map((m) => ({ key: String(m), label: t(`easy.vacancy.exp.${m}`), run: () => answer("experience", { experienceMonths: m }), wide: m === 0 })));
  } else if (step === "employerType") {
    title = t("easy.vguide.q.employer_type");
    body = choices(
      SIMPLE_EMPLOYER_TYPES.map((v) => ({
        key: v,
        label: t(`easy.vacancy.types.${v}`),
        // o'zi uchun — ismi profildan taklif qilinadi (nomi so'ralganda tayyor turadi)
        run: () => answer("employerType", { employerType: v, ...(v === "person" && draft.orgName.trim().length < 2 ? { orgName: [viewer.firstName, viewer.lastName].filter(Boolean).join(" ") } : {}) }),
      })),
    );
  } else if (step === "orgName") {
    title = isPerson ? t("easy.vguide.q.person_name") : t("easy.vguide.q.org_name");
    const value = typing === "orgName" ? text : draft.orgName;
    body = textStep({
      label: isPerson ? t("easy.vacancy.person_name") : t("easy.vacancy.org_name"),
      value,
      onChange: (v) => (setTyping("orgName"), setText(v)),
      disabled: value.trim().length < 2,
      onSubmit: () => answer("orgName", { orgName: value.trim().replace(/\s+/g, " ") }),
    });
  } else if (step === "phone") {
    title = t("easy.vguide.q.phone");
    const value = typing === "phone" ? text : draft.phone;
    body = textStep({
      label: t("easy.vacancy.phone"),
      value,
      onChange: (v) => (setTyping("phone"), setText(v)),
      disabled: !normalizePhone(value),
      onSubmit: () => answer("phone", { phone: value }),
      input: <PhoneInput id="guide-phone" value={value} onChange={(v) => (setTyping("phone"), setText(v))} />,
    });
  } else if (step === "notes") {
    // ixtiyoriy izoh (ega, 2026-11-22): tayyor variantlar (bir nechtasi) va/yoki o'z so'zi bilan; e'lon matniga ✅ bilan
    title = t("easy.vguide.q.notes");
    const picks = VACANCY_NOTE_PRESETS.filter((k) => notePicks.includes(k)).map((k) => t(`easy.notes.vacancy.${k}`));
    body = (
      <div className="space-y-3" data-guide-notes>
        <p className="text-base text-muted-foreground">{t("easy.vguide.notes_hint")}</p>
        <ul className="flex flex-wrap gap-2">
          {VACANCY_NOTE_PRESETS.map((k) => {
            const on = notePicks.includes(k);
            return (
              <li key={k}>
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => setNotePicks((p) => (on ? p.filter((x) => x !== k) : [...p, k]))}
                  className={cn("press inline-flex min-h-11 items-center gap-1.5 rounded-full border-2 px-3.5 text-base font-semibold", on ? "border-primary bg-primary-soft text-primary-ink" : "border-border bg-card hover:border-primary/60")}
                  data-guide-note={k}
                >
                  {on ? <Check className="size-4" aria-hidden /> : null} {t(`easy.notes.vacancy.${k}`)}
                </button>
              </li>
            );
          })}
        </ul>
        <Textarea value={typing === "notes" ? text : ""} onChange={(e) => (setTyping("notes"), setText(e.target.value.slice(0, 300)))} placeholder={t("easy.vguide.notes_placeholder")} aria-label={t("easy.vguide.q.notes")} className="min-h-24 rounded-2xl text-lg" data-guide-input />
        <Button type="button" size="xl" fullWidth disabled={!picks.length && !(typing === "notes" && text.trim())} onClick={() => answer("notes", { notes: formatNotes(typing === "notes" ? text : "", picks), description: "" })} data-guide-next>
          {t("easy.vguide.next")} <ArrowRight className="size-5" aria-hidden />
        </Button>
        <Button type="button" variant="ghost" size="lg" fullWidth className="text-base" onClick={() => answer("notes", { notes: [], description: "" })} data-guide-notes-skip>
          {t("easy.vguide.notes_skip")}
        </Button>
      </div>
    );
  } else if (step === "description") {
    title = t("easy.vguide.q.description");
    const base =
      draft.description.trim().length >= 10
        ? draft.description
        : composeDescription({
            sentence,
            need: t("easy.vguide.tpl.need", { profession: professionName }),
            place: draft.place.regionId || draft.place.remote ? t("easy.vguide.tpl.place", { place: placeLabel(draft.place, regions, districts, name, t) }) : null,
            schedule: draft.schedule ? t("easy.vguide.tpl.schedule", { schedule: tEnum("work_schedule", draft.schedule) }) : null,
            experience: t(`easy.vguide.tpl.exp_${draft.experienceMonths}`),
          });
    // kasbga xos javoblar va izoh — matn oxirida, ✅ bilan (bir marta)
    const items = [...extraLines(draft.extras, keys, t), ...(draft.notes ?? [])];
    const block = notesBlock(items);
    const proposed = block && !base.includes(block) ? withNotes(base, items) : base;
    body =
      typing === "description" ? (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (text.trim().length >= 10) answer("description", { description: text.trim() });
          }}
        >
          <Textarea value={text} onChange={(e) => setText(e.target.value.slice(0, 4000))} aria-label={t("easy.vacancy.description")} autoFocus className="min-h-[160px] rounded-2xl text-lg" data-guide-input />
          <Button type="submit" size="xl" fullWidth disabled={text.trim().length < 10} data-guide-next>
            {t("easy.vguide.next")} <ArrowRight className="size-5" aria-hidden />
          </Button>
        </form>
      ) : (
        <div className="space-y-3">
          <p className="whitespace-pre-line rounded-2xl border border-border bg-card p-4 text-lg leading-relaxed" data-guide-description>
            {proposed}
          </p>
          {choices([
            { key: "ok", label: t("easy.vguide.desc_ok"), run: () => answer("description", { description: proposed }), on: true },
            { key: "edit", label: t("easy.vguide.desc_edit"), run: () => (setTyping("description"), setText(proposed)) },
          ])}
        </div>
      );
  } else {
    // hammasi tayyor: bir ekranda tekshirish va joylash
    title = t("easy.vguide.done_title");
    const row = (s: GuideStep | GuideStep[], label: string, value: ReactNode) => (
      <ReviewRow key={String(s)} label={label} onChange={() => (Array.isArray(s) ? s : [s]).forEach(undo)} changeLabel={t("easy.wizard.change")}>
        {value}
      </ReviewRow>
    );
    const salary = draft.negotiable
      ? t("easy.vacancy.negotiable")
      : `${formatMoneyShort(parseMoney(draft.salaryFrom), locale)}${parseMoney(draft.salaryTo) ? ` – ${formatMoneyShort(parseMoney(draft.salaryTo), locale)}` : ""} · ${daily ? t("easy.vacancy.pay_daily") : t("easy.vacancy.pay_monthly")}`;
    body = (
      <div className="space-y-4" data-guide-done>
        <div className="rounded-2xl border border-border bg-card px-4">
          {row("profession", t("easy.wizard.steps.specialist"), professionName)}
          {keys.map((k) => {
            const v = draft.extras?.[k];
            const s = `x_${k}` as GuideStep;
            // kasbga xos javoblar — kasbdan keyin (savollar tartibida)
            return v ? row(s, t(`easy.vguide.x.${k}.label`), extraOption(k, v)) : null;
          })}
          {row(draft.place.remote ? "region" : "district", t("easy.wizard.steps.location"), placeLabel(draft.place, regions, districts, name, t))}
          {row("salary", t("easy.aichat.salary"), salary)}
          {guideRelevant("schedule", draft, keys) ? row("schedule", t("easy.vacancy.schedule"), draft.schedule ? tEnum("work_schedule", draft.schedule) : t("easy.vguide.any")) : null}
          {guideRelevant("hours", draft, keys) ? row("hours", t("easy.vguide.hours_label"), <span className="tabular">{hoursText(draft.hours)}</span>) : null}
          {draft.gender ? row("gender", t("easy.vguide.gender_label"), genderText(draft.gender)) : null}
          {draft.age ? row("age", t("easy.vguide.age_label"), ageText(draft.age)) : null}
          {row("experience", t("easy.vacancy.experience"), t(`easy.vacancy.exp.${draft.experienceMonths}`))}
          {row(
            ["employerType", "orgName"],
            t("easy.vacancy.employer_type"),
            <>
              {draft.orgName}
              {draft.employerType ? <span className="block text-base font-normal text-muted-foreground">{t(`easy.vacancy.types.${draft.employerType}`)}</span> : null}
            </>,
          )}
          {row("phone", t("easy.vacancy.phone"), <span className="tabular">{formatPhone(normalizePhone(draft.phone))}</span>)}
          {row("description", t("easy.vacancy.description"), <span className="whitespace-pre-line font-normal">{draft.description}</span>)}
        </div>
        {/* e'lon rasmi — joylashdan OLDIN (ega, 2026-11-22: "ma'qul kelsa joylash kerak") */}
        {imageEnabled && viewer.loggedIn ? (
          <ListingImageDraft entity="vacancy" professionId={draft.profession?.id ?? null} title={draft.title.trim() || professionName} value={draft.image ?? null} onChange={(image) => update({ image })} />
        ) : null}
        {/* 2026-11-18 (ega): raqam majburiy va hammaga ko'rinadi */}
        <PhonePublicNote kind="vacancy" />
        <FieldError message={error} />
        <Button type="button" size="xl" fullWidth className="h-14 text-lg" loading={pending} onClick={onPublish} data-guide-publish>
          {!pending ? <Check className="size-5" aria-hidden /> : null} {viewer.loggedIn ? t("easy.wizard.publish") : t("easy.wizard.login_to_publish")}
        </Button>
      </div>
    );
  }

  return (
    <div className="container-narrow pb-16 pt-3 sm:pt-6" inert={busy || undefined} aria-busy={busy || undefined} data-vacancy-guide data-guide-step={started ? (step ?? "done") : "intro"}>
      <header className="mb-5 space-y-3">
        <div className="flex items-center gap-2">
          {started ? (
            <button type="button" onClick={back} disabled={thinking} aria-label={t("easy.vguide.back")} className="press -ml-2 flex size-11 shrink-0 items-center justify-center rounded-xl hover:bg-secondary" data-guide-back>
              <ChevronLeft className="size-6" aria-hidden />
            </button>
          ) : (
            <Link href="/" aria-label={t("easy.vguide.back")} className="press -ml-2 flex size-11 shrink-0 items-center justify-center rounded-xl hover:bg-secondary">
              <ChevronLeft className="size-6" aria-hidden />
            </Link>
          )}
          <AiAvatar size="sm" busy={thinking} />
          <p className="min-w-0 flex-1 truncate text-base font-bold text-ai">{t("easy.vguide.title")}</p>
          {started ? (
            <span className="shrink-0 text-sm font-semibold tabular-nums text-muted-foreground" data-guide-progress>
              {t("easy.vguide.progress", { done: progress.done, total: progress.total })}
            </span>
          ) : null}
        </div>
        {started ? (
          <div className="h-2 overflow-hidden rounded-full bg-border" aria-hidden>
            <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${Math.round((progress.done / progress.total) * 100)}%` }} />
          </div>
        ) : null}
      </header>

      {started && understood.length && step ? (
        <p className="mb-4 flex flex-wrap items-center gap-1.5 text-sm font-semibold text-muted-foreground" data-guide-understood>
          {t("easy.vguide.understood")}
          {understood.map((u) => (
            <span key={u} className="inline-flex min-h-7 items-center rounded-full border border-primary/25 bg-card px-2.5 text-sm font-semibold text-primary-ink">
              {u}
            </span>
          ))}
        </p>
      ) : null}

      <h1 className="text-2xl font-extrabold leading-tight sm:text-3xl" aria-live="polite">
        {title}
      </h1>
      {!started ? <p className="mt-1 text-base text-muted-foreground">{t("easy.vguide.intro_hint")}</p> : step === null ? <p className="mt-1 text-base text-muted-foreground">{t("easy.vguide.done_hint")}</p> : null}

      <div key={`${started ? step : "intro"}:${typing ?? ""}:${options.length}`} className="step-forward mt-5">
        {body}
      </div>
      <FieldError message={err} />

      <div className="mt-8 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-border pt-3">
        <button type="button" onClick={onClassic} className="inline-flex min-h-11 items-center text-sm font-semibold text-muted-foreground hover:text-foreground" data-guide-classic>
          {t("easy.vguide.classic")}
        </button>
        {started ? (
          <button
            type="button"
            onClick={() => (setStarted(false), setHistory([]), setAsked(new Set()), setOptions([]), setTyping(null), setText(""), setErr(null))}
            className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground"
            data-guide-restart
          >
            <RotateCcw className="size-4" aria-hidden /> {t("easy.vguide.restart")}
          </button>
        ) : null}
      </div>
    </div>
  );
}
