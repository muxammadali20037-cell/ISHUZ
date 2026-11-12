"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { ArrowUp, Check, RotateCcw, Sparkles } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AiAvatar } from "@/components/shared/ai-avatar";
import { callAction } from "@/lib/action-call";
import { formatMoney, normalizePhone } from "@/lib/format";
import { isCityRegion } from "@/lib/geo/city";
import { cn } from "@/lib/utils";
import type { District, Region } from "@/lib/reference";
import {
  listingChatTurn,
  type ChatTurnResult,
  type ProfessionOption,
} from "../chat-actions";
import {
  CHAT_SCHEDULES,
  EMPTY_COLLECTED,
  chatProgress,
  nextField,
  type ChatCollected,
  type ChatField,
} from "../chat-logic";
import { SIMPLE_EXPERIENCE, type SimpleExperience } from "../types";

type Msg = { id: number; role: "bot" | "you"; text: string };
type Chip = { key: string; label: string; run: () => void };

const WHOLE =
  /(butun|бутун|весь|вся|всё|whole|all\b|farqi\s+yo|фарқи\s+йўқ|не\s+важно)/iu;

/**
 * "Tez va qulay e'lon — AI bilan" (ish izlovchi, 1-qadam): foydalanuvchi bir gap yozadi ("kuryer bo'lib ishlamoqchiman"), yordamchi
 * e'lon uchun yetishmayotganlarini birma-bir so'raydi — tugmalar (viloyat, tuman, tajriba, grafik) yoki erkin matn bilan.
 * Oxirida yig'ilganlari e'lon qoralamasiga qo'yiladi va tekshirish sahifasi ochiladi: hech narsa o'zi joylanmaydi.
 */
export function ListingChat({
  regions,
  districts,
  knownFirstName,
  needPhone,
  onActiveChange,
  onFinish,
}: {
  regions: Region[];
  districts: District[];
  /** profil yoki qoralamadagi ism — bo'lsa so'ralmaydi */
  knownFirstName: string;
  /** mehmon: telefon so'raladi (kirgan foydalanuvchida telefon profildan) */
  needPhone: boolean;
  onActiveChange: (active: boolean) => void;
  onFinish: (c: ChatCollected) => void;
}) {
  const { t, name, tEnum, locale } = useT();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [c, setC] = useState<ChatCollected>(EMPTY_COLLECTED);
  const [options, setOptions] = useState<ProfessionOption[]>([]);
  const [typing, setTyping] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const seq = useRef(0);
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const started = msgs.length > 0;
  const viewer = { firstName: knownFirstName, hasPhone: !needPhone };
  const field = started ? nextField(c, viewer) : null;
  const progress = chatProgress(c, viewer);

  useEffect(() => {
    onActiveChange(started);
  }, [started, onActiveChange]);
  useEffect(() => {
    logRef.current?.lastElementChild?.scrollIntoView({
      block: "nearest",
      behavior: "smooth",
    });
  }, [msgs.length, field]);

  const region = regions.find((r) => r.id === c.place.regionId) ?? null;
  const district = districts.find((d) => d.id === c.place.districtId) ?? null;
  const placeLabel = region
    ? district
      ? `${name(region)}, ${name(district)}`
      : name(region)
    : "";
  const professionLabel = c.profession ? name(c.profession.trail.at(-1)!) : "";
  const expLabel = (e: SimpleExperience) => t(`easy.worker.exp.${e}`);

  const question = (f: ChatField | null, s: ChatCollected): string => {
    switch (f) {
      case "profession":
        return t("easy.aichat.q_profession");
      case "region":
        return t("easy.aichat.q_region");
      case "district": {
        const r = regions.find((x) => x.id === s.place.regionId);
        return t("easy.aichat.q_district", { region: r ? name(r) : "" });
      }
      case "experience":
        return t("easy.aichat.q_experience");
      case "schedule":
        return t("easy.aichat.q_schedule");
      case "salary":
        return t("easy.aichat.q_salary");
      case "name":
        return t("easy.aichat.q_name");
      case "phone":
        return t("easy.aichat.q_phone");
      case "about":
        return t("easy.aichat.q_about");
      default:
        return t("easy.aichat.done");
    }
  };

  const say = (role: Msg["role"], line: string) =>
    setMsgs((m) => [...m, { id: ++seq.current, role, text: line }]);

  /** yangi holat: nima tushunilgani (qisqa) va keyingi savol — bitta xabarda (override — savol o'rniga boshqa matn) */
  const advance = (
    prev: ChatCollected,
    next: ChatCollected,
    lead: string[] = [],
    override?: string,
  ) => {
    const got: string[] = [...lead];
    const r = regions.find((x) => x.id === next.place.regionId);
    const d = districts.find((x) => x.id === next.place.districtId);
    if (next.profession && next.profession.id !== prev.profession?.id)
      got.push(
        t("easy.aichat.got_profession", {
          value: name(next.profession.trail.at(-1)!),
        }),
      );
    if (
      r &&
      (next.place.regionId !== prev.place.regionId ||
        next.place.districtId !== prev.place.districtId ||
        next.place.districtChosen !== prev.place.districtChosen)
    )
      got.push(
        t("easy.aichat.got_place", {
          value: d
            ? `${name(r)}, ${name(d)}`
            : next.place.districtChosen
              ? `${name(r)} (${t(isCityRegion(r) ? "easy.location.whole_city" : "easy.location.whole_region").toLowerCase()})`
              : name(r),
        }),
      );
    if (next.experience && next.experience !== prev.experience)
      got.push(
        t("easy.aichat.got_experience", { value: expLabel(next.experience) }),
      );
    if (
      next.schedule &&
      next.schedule !== prev.schedule &&
      next.schedule !== "any"
    )
      got.push(
        t("easy.aichat.got_schedule", {
          value: tEnum("work_schedule", next.schedule),
        }),
      );
    if (next.salary && next.salary !== prev.salary)
      got.push(
        next.salary === "negotiable"
          ? t("easy.aichat.got_negotiable")
          : t("easy.aichat.got_salary", {
              value: formatMoney(Number(next.salary), locale),
            }),
      );
    if (next.firstName && next.firstName !== prev.firstName)
      got.push(
        t("easy.aichat.got_name", {
          value: [next.firstName, next.lastName].filter(Boolean).join(" "),
        }),
      );
    if (next.phone && next.phone !== prev.phone)
      got.push(t("easy.aichat.got_phone"));
    if (next.about && next.about !== prev.about)
      got.push(t("easy.aichat.got_about"));
    setC(next);
    say(
      "bot",
      [...got, override ?? question(nextField(next, viewer), next)].join("\n"),
    );
  };

  const ask = (f: ChatField, s: ChatCollected, lead: string) =>
    say("bot", `${lead}\n${question(f, s)}`);

  const apply = (prev: ChatCollected, r: ChatTurnResult): ChatCollected => {
    const n: ChatCollected = { ...prev };
    if (r.profession) n.profession = r.profession;
    if (r.place)
      n.place =
        r.place.regionId === prev.place.regionId && !r.place.districtChosen
          ? prev.place
          : r.place;
    if (r.experience) n.experience = r.experience;
    if (r.schedule) n.schedule = r.schedule;
    if (r.salary) n.salary = String(r.salary);
    else if (r.negotiable) n.salary = "negotiable";
    if (r.firstName) {
      n.firstName = r.firstName;
      n.lastName = r.lastName ?? "";
    }
    if (r.about) n.about = r.about;
    return n;
  };

  const errorText = (code: string) => {
    const key = `easy.aichat.errors.${code}`;
    const msg = t(key);
    return msg === key ? t("easy.aichat.errors.failed") : msg;
  };

  const send = (raw: string) => {
    const value = raw.replace(/\s+/g, " ").trim();
    if (!value || pending) return;
    setText("");
    setError(null);
    say("you", value);
    const f = started ? field : null;
    // telefon — faqat qurilmada tekshiriladi (serverga yuborilmaydi)
    if (f === "phone") {
      const phone = normalizePhone(value);
      if (phone) advance(c, { ...c, phone: value });
      else ask("phone", c, t("easy.aichat.bad_phone"));
      return;
    }
    // tuman o'rniga "butun viloyat"
    if (f === "district" && WHOLE.test(value)) {
      advance(c, {
        ...c,
        place: { ...c.place, districtId: null, districtChosen: true },
      });
      return;
    }
    if (f === "schedule" && WHOLE.test(value)) {
      advance(c, { ...c, schedule: "any" });
      return;
    }
    const serverField =
      f === null ? "start" : f === "region" || f === "district" ? "place" : f;
    start(async () => {
      const res = await callAction(() =>
        listingChatTurn({
          field: serverField,
          text: value,
          regionId: c.place.regionId,
          locale,
        }),
      );
      if (!res.ok || !res.data) {
        const code = res.ok ? "failed" : res.error;
        if (code === "prohibited") say("bot", errorText("prohibited"));
        else setError(errorText(code));
        return;
      }
      const r = res.data;
      setOptions(r.professionOptions ?? []);
      setTyping(false);
      const n = apply(c, r);
      if (f === null) {
        // birinchi gap: tushunilganlari va keyingi savol (kasb aniq bo'lmasa — variantlardan tanlash)
        advance(
          c,
          n,
          [t("easy.aichat.hello")],
          !n.profession && r.professionOptions?.length
            ? t("easy.aichat.q_profession_pick")
            : undefined,
        );
        return;
      }
      if (f === "profession" && !n.profession && r.professionOptions?.length) {
        say("bot", t("easy.aichat.q_profession_pick"));
        return;
      }
      if (!r.understood) {
        ask(
          f!,
          c,
          t(
            `easy.aichat.not_understood.${f === "region" || f === "district" ? "place" : f}`,
          ),
        );
        return;
      }
      advance(c, n);
    });
  };

  const pickProfession = (o: ProfessionOption) => {
    say("you", name(o));
    setOptions([]);
    start(async () => {
      const res = await callAction(() =>
        listingChatTurn({
          field: "profession",
          text: o.name_uz,
          nodeId: o.id,
          regionId: c.place.regionId,
          locale,
        }),
      );
      if (!res.ok || !res.data?.profession) {
        setError(errorText(res.ok ? "failed" : res.error));
        return;
      }
      advance(c, { ...c, profession: res.data.profession });
    });
  };

  const choose = (label: string, next: ChatCollected) => {
    say("you", label);
    setOptions([]);
    advance(c, next);
  };

  const chips: Chip[] = (() => {
    if (!started || pending) return [];
    if (field === "profession" && options.length)
      return [
        ...options.map((o) => ({
          key: o.id,
          label: name(o),
          run: () => pickProfession(o),
        })),
        {
          key: "other",
          label: t("easy.aichat.other_profession"),
          run: () => (
            setOptions([]),
            setTyping(true),
            say("bot", t("easy.aichat.q_profession_type"))
          ),
        },
      ];
    if (field === "region")
      return regions.map((r) => ({
        key: r.id,
        label: name(r),
        run: () =>
          choose(name(r), {
            ...c,
            place: {
              regionId: r.id,
              districtId: null,
              districtChosen: false,
              remote: false,
            },
          }),
      }));
    if (field === "district" && region) {
      const whole = t(
        isCityRegion(region)
          ? "easy.location.whole_city"
          : "easy.location.whole_region",
      );
      return [
        {
          key: "whole",
          label: whole,
          run: () =>
            choose(whole, {
              ...c,
              place: { ...c.place, districtId: null, districtChosen: true },
            }),
        },
        ...districts
          .filter((d) => d.region_id === region.id)
          .map((d) => ({
            key: d.id,
            label: name(d),
            run: () =>
              choose(name(d), {
                ...c,
                place: { ...c.place, districtId: d.id, districtChosen: true },
              }),
          })),
      ];
    }
    if (field === "experience")
      return SIMPLE_EXPERIENCE.map((e) => ({
        key: e,
        label: expLabel(e),
        run: () => choose(expLabel(e), { ...c, experience: e }),
      }));
    if (field === "schedule")
      return [
        ...CHAT_SCHEDULES.map((s) => ({
          key: s,
          label: tEnum("work_schedule", s),
          run: () => choose(tEnum("work_schedule", s), { ...c, schedule: s }),
        })),
        {
          key: "any",
          label: t("easy.aichat.any_schedule"),
          run: () =>
            choose(t("easy.aichat.any_schedule"), { ...c, schedule: "any" }),
        },
      ];
    if (field === "salary")
      return [
        {
          key: "neg",
          label: t("easy.aichat.negotiable"),
          run: () =>
            choose(t("easy.aichat.negotiable"), { ...c, salary: "negotiable" }),
        },
      ];
    if (field === "about") {
      const compose = () => {
        const lines = [
          t("easy.aichat.about_tpl.profession", { value: professionLabel }),
          c.experience === "none"
            ? t("easy.aichat.about_tpl.noexp")
            : c.experience
              ? t("easy.aichat.about_tpl.experience", {
                  value: expLabel(c.experience),
                })
              : null,
          placeLabel
            ? t("easy.aichat.about_tpl.place", { value: placeLabel })
            : null,
          c.schedule && c.schedule !== "any"
            ? t("easy.aichat.about_tpl.schedule", {
                value: tEnum("work_schedule", c.schedule),
              })
            : null,
        ].filter((x): x is string => !!x);
        choose(t("easy.aichat.compose"), { ...c, about: lines.join(" ") });
      };
      return [
        { key: "compose", label: t("easy.aichat.compose"), run: compose },
      ];
    }
    return [];
  })();

  const restart = () => {
    setMsgs([]);
    setC(EMPTY_COLLECTED);
    setOptions([]);
    setTyping(false);
    setError(null);
    setText("");
  };

  // matn kiritish: tanlovli savollarda ham yozish mumkin (masalan "Chilonzor" yoki "3 yil"); kasb variantlarida — "Boshqa kasb" bosilganda
  const canType =
    !started ||
    (field !== null && !(field === "profession" && options.length && !typing));
  const placeholder = !started
    ? t("easy.aichat.start_placeholder")
    : field === "phone"
      ? "+998 90 123 45 67"
      : t("easy.aichat.answer_placeholder");

  return (
    <section
      className="space-y-3 rounded-2xl border-2 border-ai/30 bg-ai-soft/60 p-4"
      aria-labelledby="ai-chat-title"
      data-listing-chat
    >
      <div className="flex items-start gap-3">
        <AiAvatar size="md" className="shrink-0" />
        <div className="min-w-0">
          {/* sarlavha emas: sahifaning asosiy sarlavhasi (h1) — kasb savoli; karta uning ustida turadi */}
          <p id="ai-chat-title" className="text-lg font-bold leading-snug">
            {t("easy.aichat.title")}
          </p>
          <p className="text-base text-muted-foreground">
            {started
              ? t("easy.aichat.progress", {
                  done: progress.done,
                  total: progress.total,
                })
              : t("easy.aichat.desc")}
          </p>
        </div>
      </div>

      {started ? (
        <div
          ref={logRef}
          role="log"
          aria-live="polite"
          aria-label={t("easy.aichat.log")}
          className="max-h-[52vh] space-y-2 overflow-y-auto pr-1"
          data-chat-log
        >
          {msgs.map((m) => (
            <p
              key={m.id}
              data-chat-msg={m.role}
              className={cn(
                "w-fit max-w-[92%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-base [overflow-wrap:anywhere]",
                m.role === "you"
                  ? "ml-auto rounded-br-md bg-primary text-primary-foreground"
                  : "rounded-bl-md bg-card text-foreground ring-1 ring-border",
              )}
            >
              {m.text}
            </p>
          ))}
          {pending ? (
            <p
              className="w-fit rounded-2xl rounded-bl-md bg-card px-3.5 py-2.5 text-base text-muted-foreground ring-1 ring-border"
              role="status"
            >
              {t("easy.aichat.thinking")}
            </p>
          ) : null}
        </div>
      ) : null}

      {chips.length ? (
        <ul
          className="flex flex-wrap gap-2"
          aria-label={t("easy.aichat.choices")}
          data-chat-chips
        >
          {chips.map((ch) => (
            <li key={ch.key}>
              <button
                type="button"
                onClick={ch.run}
                data-chat-chip={ch.key}
                className="press min-h-11 rounded-full border border-primary/30 bg-card px-3.5 text-left text-base font-semibold text-primary-ink hover:bg-primary-soft"
              >
                {ch.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {started && field === null ? (
        <div
          className="space-y-3 rounded-xl bg-card p-3 ring-1 ring-border"
          data-chat-summary
        >
          <dl className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-1 text-base">
            <dt className="text-muted-foreground">
              {t("easy.wizard.steps.profession")}
            </dt>
            <dd className="font-semibold">{professionLabel}</dd>
            <dt className="text-muted-foreground">
              {t("easy.wizard.steps.location")}
            </dt>
            <dd className="font-semibold">
              {district || !region
                ? placeLabel
                : `${placeLabel} · ${t(isCityRegion(region) ? "easy.location.whole_city" : "easy.location.whole_region")}`}
            </dd>
            <dt className="text-muted-foreground">
              {t("easy.worker.experience")}
            </dt>
            <dd className="font-semibold">
              {c.experience ? expLabel(c.experience) : ""}
            </dd>
            {c.schedule && c.schedule !== "any" ? (
              <>
                <dt className="text-muted-foreground">
                  {t("easy.aichat.schedule")}
                </dt>
                <dd className="font-semibold">
                  {tEnum("work_schedule", c.schedule)}
                </dd>
              </>
            ) : null}
            {c.salary && c.salary !== "negotiable" ? (
              <>
                <dt className="text-muted-foreground">
                  {t("easy.aichat.salary")}
                </dt>
                <dd className="font-semibold">
                  {formatMoney(Number(c.salary), locale)}
                </dd>
              </>
            ) : null}
          </dl>
          <Button
            type="button"
            size="xl"
            fullWidth
            onClick={() => onFinish(c)}
            data-chat-finish
          >
            <Check className="size-5" aria-hidden /> {t("easy.aichat.finish")}
          </Button>
        </div>
      ) : null}

      {canType && (!started || field !== null) ? (
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            send(text);
          }}
        >
          <Input
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, 600))}
            placeholder={placeholder}
            aria-label={
              started
                ? t("easy.aichat.answer_label")
                : t("easy.aichat.start_label")
            }
            inputMode={field === "phone" ? "tel" : undefined}
            className="h-12 flex-1 rounded-xl bg-card text-base"
            data-chat-input
          />
          <Button
            type="submit"
            size="lg"
            disabled={pending || !text.trim()}
            aria-label={
              started ? t("easy.aichat.send") : t("easy.aichat.start")
            }
            className="h-12 shrink-0 px-4"
            data-chat-send
          >
            {started ? (
              <ArrowUp className="size-5" aria-hidden />
            ) : (
              <Sparkles className="size-5" aria-hidden />
            )}
            {started ? null : <span>{t("easy.aichat.start")}</span>}
          </Button>
        </form>
      ) : null}
      {error ? (
        <p role="alert" className="text-base text-destructive">
          {error}
        </p>
      ) : null}
      {!started ? (
        <p className="text-sm text-muted-foreground">{t("easy.aichat.note")}</p>
      ) : null}
      {started ? (
        <div className="flex flex-wrap gap-x-4">
          <button
            type="button"
            onClick={restart}
            className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground"
            data-chat-restart
          >
            <RotateCcw className="size-4" aria-hidden />{" "}
            {t("easy.aichat.restart")}
          </button>
        </div>
      ) : null}
    </section>
  );
}
