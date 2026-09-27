"use client";

import { useCallback, useState, type FormEvent, type ReactNode } from "react";
import type { FieldErrors, FieldValues, Path, UseFormTrigger } from "react-hook-form";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

export interface FlowQuestion<T extends FieldValues> {
  id: string;
  /** "Keyingi" bosilganda shu maydonlar tekshiriladi */
  fields?: Path<T>[];
  /** true — savol o'tkazib yuboriladi (masalan, telefon allaqachon tasdiqlangan) */
  hidden?: boolean;
}

function hasError(errors: FieldErrors, path: string): boolean {
  let node: unknown = errors;
  for (const key of path.split(".")) {
    if (!node || typeof node !== "object") return false;
    node = (node as Record<string, unknown>)[key];
  }
  return !!node;
}

/**
 * Bitta forma — bir nechta savol: har ekranda bittasi, "Keyingi" joriy savol maydonlarini tekshiradi.
 * Oxirgi savolda forma odatdagidek yuboriladi (server action va schema o'zgarmaydi).
 */
export function useQuestionFlow<T extends FieldValues>(questions: FlowQuestion<T>[], trigger: UseFormTrigger<T>) {
  const visible = questions.filter((q) => !q.hidden);
  const [rawIndex, setIndex] = useState(0);
  const index = Math.max(0, Math.min(rawIndex, visible.length - 1));
  const current = visible[index];
  const isLast = index >= visible.length - 1;
  const go = useCallback((n: number) => {
    setIndex(n);
    if (window.scrollY > 0) window.scrollTo({ top: 0 });
  }, []);

  const next = useCallback(async () => {
    const fields = current?.fields;
    if (fields?.length && !(await trigger(fields, { shouldFocus: true }))) return;
    go(index + 1);
  }, [current, trigger, go, index]);

  /** Bitta tanlovli savollar uchun: tanlangandan keyin o'zi keyingisiga o'tadi */
  const advance = useCallback(() => {
    if (!isLast) window.setTimeout(() => void next(), 220);
  }, [isLast, next]);

  const back = useCallback(() => go(index - 1), [go, index]);

  /** To'liq tekshiruvda xato chiqsa — xatoli birinchi savolga qaytaradi */
  const onInvalid = useCallback(
    (errors: FieldErrors<T>) => {
      const i = visible.findIndex((q) => q.fields?.some((f) => hasError(errors, f)));
      if (i >= 0) go(i);
    },
    [visible, go],
  );

  /** form onSubmit: oxirgi savolgacha Enter/"Keyingi" — keyingi savol, oxirida — haqiqiy yuborish */
  const bindSubmit = (submit: (e?: FormEvent) => Promise<void>) => (e: FormEvent) => {
    if (!isLast) {
      e.preventDefault();
      void next();
      return;
    }
    void submit(e);
  };

  return {
    index,
    total: visible.length,
    isFirst: index === 0,
    isLast,
    is: (id: string) => current?.id === id,
    next,
    advance,
    back,
    onInvalid,
    bindSubmit,
  };
}

export type QuestionFlow = ReturnType<typeof useQuestionFlow>;

/** "Savol 2 / 5" + bo'lakli progress */
export function QuestionProgress({ flow, className }: { flow: Pick<QuestionFlow, "index" | "total">; className?: string }) {
  const { t } = useT();
  if (flow.total <= 1) return null;
  return (
    <div className={className}>
      <p className="mb-2 text-xs font-medium text-muted-foreground tabular">{t("common.labels.question_of", { current: flow.index + 1, total: flow.total })}</p>
      <div className="flex gap-1" aria-hidden>
        {Array.from({ length: flow.total }, (_, i) => (
          <span key={i} className={cn("h-1 flex-1 rounded-full transition-colors", i <= flow.index ? "bg-primary" : "bg-border")} />
        ))}
      </div>
    </div>
  );
}

/** Bitta savol bloki (kalit o'zgarganda yumshoq paydo bo'ladi) */
export function Question({ show, children, className }: { show: boolean; children: ReactNode; className?: string }) {
  if (!show) return null;
  return <div className={cn("animate-fade-in space-y-4", className)}>{children}</div>;
}
