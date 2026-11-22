"use client";

import { ListingImageDraft } from "@/features/listing-image/components/listing-image-draft";
import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, Check, ChevronLeft, RotateCcw, Sparkles } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { callAction } from "@/lib/action-call";
import { formatMoneyShort, formatPhone, normalizePhone } from "@/lib/format";
import { isCityRegion } from "@/lib/geo/city";
import type { District, Region } from "@/lib/reference";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { AiAvatar } from "@/components/shared/ai-avatar";
import { cn } from "@/lib/utils";
import type { ProfessionOption } from "../chat-actions";
import { vacancyGuideTurn, type GuideParse } from "../guide-actions";
import { SALARY_PRESETS, composeDescription, guideProgress, nextGuideStep, type GuideStep } from "../guide-logic";
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
  const [thinking, start] = useTransition();

  const step = started ? nextGuideStep(draft, asked) : null;
  const progress = guideProgress(draft, asked);
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
    if (s === "profession") Object.assign(patch, { profession: null, custom: null, title: "" });
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
      if (["profession", "region", "district", "schedule", "experience", "notes"].includes(s)) n.delete("description");
      return n;
    });
    setHistory((h) => h.filter((x) => x !== s));
    setTyping(null);
    setText("");
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
        profession: p.profession ?? null,
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
      answer("profession", { profession: res.data.profession, custom: null });
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
      if (res.data.profession) answer("profession", { profession: res.data.profession, custom: null });
      else if (res.data.professionOptions?.length) {
        setOptions(res.data.professionOptions);
        setTyping(null);
        setText("");
      } else setErr(t("easy.vguide.not_understood"));
    });
  };

  // ---------------------------------------------------------------------------------------------------- ekranlar

  const understood = [
    professionName,
    draft.place.regionId || draft.place.remote ? placeLabel(draft.place, regions, districts, name, t) : null,
    draft.negotiable ? t("easy.vacancy.negotiable") : parseMoney(draft.salaryFrom) ? `${formatMoneyShort(parseMoney(draft.salaryFrom), locale)}${daily ? ` · ${t("easy.vacancy.pay_daily").toLowerCase()}` : ""}` : null,
    draft.schedule ? tEnum("work_schedule", draft.schedule) : null,
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
    title = daily ? t("easy.vguide.q.salary_daily") : t("easy.vguide.q.salary");
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
    // izoh — matn oxirida, ✅ bilan (bir marta)
    const block = notesBlock(draft.notes ?? []);
    const proposed = block && !base.includes(block) ? withNotes(base, draft.notes ?? []) : base;
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
          {row(draft.place.remote ? "region" : "district", t("easy.wizard.steps.location"), placeLabel(draft.place, regions, districts, name, t))}
          {row("salary", t("easy.aichat.salary"), salary)}
          {row("schedule", t("easy.vacancy.schedule"), draft.schedule ? tEnum("work_schedule", draft.schedule) : t("easy.vguide.any"))}
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
