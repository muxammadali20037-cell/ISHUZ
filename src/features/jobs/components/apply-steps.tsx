"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, FileText, Info, Send, UserRound, Zap } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { APPLY_MESSAGE_MAX } from "../limits";

/**
 * 10 · Ariza yuborish — 3 qadam (ega "MASTER PROMPT", 2026-11-16): 1) rezyume, 2) qo'shimcha ma'lumot, 3) tasdiqlash.
 * Rezyume — profil (ish beruvchi arizada profilni ko'radi; PDF — profildan chiziladi) yoki profilsiz tezkor ariza (ism va
 * telefon). PDF fayl yuklash bazada yo'q — tugma ham yo'q (soxta imkoniyat ko'rsatilmaydi). Yuborish — mavjud
 * applyToVacancy (takror arizaga baza qarshi).
 */
type Step = 1 | 2 | 3;

const QUICK_LINES = ["start_now", "have_experience", "part_time_ok"] as const;

export function ApplySteps({
  quick,
  vacancy,
  message,
  setMessage,
  pending,
  onSubmit,
  createResumeHref,
}: {
  /** profilsiz tezkor ariza (ism va telefon bilan) */
  quick: boolean;
  vacancy: { title: string; companyName: string | null };
  message: string;
  setMessage: (v: string) => void;
  pending: boolean;
  onSubmit: () => void;
  /** "Rezyume yaratish" — anketaga, so'ng shu vakansiyaga ariza oynasi bilan qaytish */
  createResumeHref: string;
}) {
  const { t } = useT();
  const [step, setStep] = useState<Step>(1);
  const names = { 1: t("jobs.apply.steps.resume"), 2: t("jobs.apply.steps.extra"), 3: t("jobs.apply.steps.confirm") } as const;
  const resumeLabel = quick ? t("jobs.apply.resume.quick_title") : t("jobs.apply.resume.profile_title");

  const addLine = (key: (typeof QUICK_LINES)[number]) => {
    const line = t(`jobs.apply.quick_lines.${key}`);
    if (message.includes(line)) return;
    setMessage(`${message.trim()}${message.trim() ? "\n" : ""}${line}`.slice(0, APPLY_MESSAGE_MAX));
  };

  const footer = (
    <div className="flex gap-2">
      {step > 1 ? (
        <Button type="button" variant="outline" size="lg" onClick={() => setStep((s) => (s - 1) as Step)} disabled={pending}>
          {t("common.actions.back")}
        </Button>
      ) : null}
      {step < 3 ? (
        <Button type="button" size="lg" fullWidth onClick={() => setStep((s) => (s + 1) as Step)}>
          {t("jobs.apply.next")}
        </Button>
      ) : (
        <Button type="button" size="lg" fullWidth onClick={onSubmit} loading={pending}>
          <Send className="size-4" /> {t("jobs.apply.submit")}
        </Button>
      )}
    </div>
  );

  return (
    <Sheet title={t("jobs.apply.title")} description={`${t("jobs.apply.step_of", { current: step, total: 3 })} · ${names[step]}`} footer={footer}>
      {/* qadamlar ko'rsatkichi */}
      <ol className="mb-4 grid grid-cols-3 gap-1.5" aria-label={t("jobs.apply.steps.label")} data-apply-steps>
        {([1, 2, 3] as const).map((n) => (
          <li key={n} aria-current={n === step ? "step" : undefined} className="min-w-0">
            <span className={cn("block h-1.5 rounded-full", n <= step ? "bg-primary" : "bg-border")} aria-hidden />
            <span className={cn("mt-1 block truncate text-xs font-semibold", n === step ? "text-primary-ink" : "text-muted-foreground")}>{names[n]}</span>
          </li>
        ))}
      </ol>

      {step === 1 ? (
        <div className="grid gap-3" data-apply-step="resume">
          <div className="flex items-start gap-3 rounded-2xl border-2 border-primary bg-primary-soft p-4" aria-current="true">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-card text-primary-ink" aria-hidden>
              {quick ? <Zap className="size-5" /> : <UserRound className="size-5" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-bold">{resumeLabel}</span>
              <span className="mt-0.5 block text-sm text-muted-foreground">{quick ? t("jobs.apply.quick_note") : t("jobs.apply.resume.profile_desc")}</span>
              {!quick ? (
                <a href="/api/cv/pdf" className="mt-2 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-primary-ink hover:underline">
                  <FileText className="size-4" aria-hidden /> {t("jobs.apply.resume.download_pdf")}
                </a>
              ) : null}
            </span>
            <Check className="size-5 shrink-0 text-primary-ink" aria-hidden />
          </div>
          <Link
            href={quick ? createResumeHref : "/profile"}
            className="flex min-h-14 items-center gap-3 rounded-2xl border border-border bg-card px-4 text-sm font-semibold hover:border-primary/50"
          >
            <FileText className="size-5 shrink-0 text-muted-foreground" aria-hidden />
            {quick ? t("jobs.apply.resume.create") : t("jobs.apply.resume.edit")}
          </Link>
        </div>
      ) : null}

      {step === 2 ? (
        <div data-apply-step="extra">
          <Field
            label={t("jobs.apply.message_label")}
            hint={t("jobs.apply.message_hint")}
            htmlFor="apply-message"
            description={t("jobs.apply.chars", { count: message.length, max: APPLY_MESSAGE_MAX })}
          >
            <Textarea
              id="apply-message"
              value={message}
              onChange={(e) => setMessage(e.target.value.slice(0, APPLY_MESSAGE_MAX))}
              maxLength={APPLY_MESSAGE_MAX}
              placeholder={t("jobs.apply.message_placeholder")}
              className="min-h-[140px]"
              disabled={pending}
            />
          </Field>
          <p className="mt-3 text-sm font-semibold">{t("jobs.apply.quick_lines.title")}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {QUICK_LINES.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => addLine(k)}
                className="press inline-flex min-h-11 items-center rounded-full border border-border bg-card px-4 text-sm font-semibold hover:border-primary/50"
              >
                + {t(`jobs.apply.quick_lines.${k}`)}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <dl className="grid gap-3 text-sm" data-apply-step="confirm">
          <div className="rounded-2xl border border-border p-4">
            <dt className="text-muted-foreground">{t("jobs.apply.confirm.vacancy")}</dt>
            <dd className="mt-0.5 font-bold">{vacancy.title}</dd>
            {vacancy.companyName ? <dd className="text-muted-foreground">{vacancy.companyName}</dd> : null}
          </div>
          <div className="rounded-2xl border border-border p-4">
            <dt className="text-muted-foreground">{t("jobs.apply.confirm.resume")}</dt>
            <dd className="mt-0.5 font-bold">{resumeLabel}</dd>
          </div>
          <div className="rounded-2xl border border-border p-4">
            <dt className="text-muted-foreground">{t("jobs.apply.message_label")}</dt>
            <dd className="mt-0.5 line-clamp-5 whitespace-pre-line">{message.trim() || t("jobs.apply.confirm.no_message")}</dd>
          </div>
          <p className="flex items-start gap-2 rounded-xl bg-secondary px-3 py-2.5">
            <Info className="mt-0.5 size-4 shrink-0 text-primary-ink" aria-hidden />
            {t(quick ? "jobs.apply.description_quick" : "jobs.apply.description")}
          </p>
        </dl>
      ) : null}
    </Sheet>
  );
}
