"use client";

import { useState, useTransition } from "react";
import { PenLine, Sparkles } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { aiDraftListing, type AiDraftResult } from "../ai-actions";
import { FieldError } from "./wizard-frame";

/**
 * 1-qadamdagi ikki yo'l: "O'zim to'ldiraman" (oddiy usta) yoki "AI bilan tez tayyorlash".
 * AI natijasi faqat qoralama: foydalanuvchi tekshiradi va o'zi joylaydi.
 */
export function AiQuickFill({ kind, onReady }: { kind: "worker" | "vacancy"; onReady: (data: AiDraftResult) => void }) {
  const { t, locale } = useT();
  const [mode, setMode] = useState<"manual" | "ai">("manual");
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const submit = () => {
    if (text.trim().length < 10) {
      setError(t("easy.ai.too_short"));
      return;
    }
    setError(null);
    start(async () => {
      const res = await aiDraftListing({ kind, text, locale });
      if (!res.ok || !res.data) {
        const key = `easy.ai.errors.${res.ok ? "ai_failed" : res.error}`;
        const msg = t(key);
        setError(msg === key ? t("easy.ai.errors.ai_failed") : msg);
        return;
      }
      onReady(res.data);
    });
  };

  const tab = (value: "manual" | "ai", icon: React.ReactNode, label: string) => (
    <button
      type="button"
      role="radio"
      aria-checked={mode === value}
      onClick={() => (setMode(value), setError(null))}
      className={cn(
        "flex min-h-14 flex-1 items-center justify-center gap-2 rounded-xl px-3 text-base font-semibold transition-colors",
        mode === value ? "bg-card text-foreground shadow-sm ring-1 ring-border" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {icon}
      {label}
    </button>
  );

  return (
    <div className="space-y-3">
      <div role="radiogroup" aria-label={t("easy.ai.choose")} className="flex gap-1 rounded-2xl bg-secondary p-1">
        {tab("manual", <PenLine className="size-5" aria-hidden />, t("easy.ai.manual"))}
        {tab("ai", <Sparkles className="size-5 text-primary" aria-hidden />, t("easy.ai.quick"))}
      </div>
      {mode === "ai" ? (
        <div className="space-y-3 rounded-2xl border-2 border-primary/30 bg-primary-soft/40 p-4">
          <label htmlFor="ai-text" className="block text-lg font-semibold">
            {t(kind === "worker" ? "easy.ai.worker_label" : "easy.ai.vacancy_label")}
          </label>
          <Textarea
            id="ai-text"
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, 1500))}
            placeholder={t(kind === "worker" ? "easy.ai.worker_example" : "easy.ai.vacancy_example")}
            invalid={!!error}
            aria-describedby="ai-text-note"
            className="min-h-[140px] rounded-2xl bg-card text-lg"
          />
          <p id="ai-text-note" className="text-base text-muted-foreground">
            {t("easy.ai.note")}
          </p>
          <FieldError message={error ?? undefined} />
          <Button type="button" size="xl" fullWidth onClick={submit} disabled={pending} aria-busy={pending}>
            <Sparkles className="size-5" aria-hidden /> {pending ? t("easy.ai.preparing") : t("easy.ai.prepare")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

/** AI qoralamasini mavjud javoblar ustiga qo'yish: bo'sh qiymatlar (null, "") avvalgi javobni o'chirmaydi */
export function mergeAiDraft<T extends { place: { regionId: string | null; remote: boolean } }>(current: T, ai: Partial<T>): Partial<T> {
  const out: Partial<T> = {};
  for (const [k, v] of Object.entries(ai) as [keyof T, T[keyof T]][]) {
    if (v === null || v === undefined || v === "") continue;
    out[k] = v;
  }
  if (ai.place && !ai.place.regionId && !ai.place.remote) out.place = current.place;
  return out;
}

/** Tekshirish sahifasida: "AI e'loningizni tayyorladi…" + yetishmayotgan ma'lumot uchun qisqa savollar */
export function AiReadyBanner({ questions, onEdit }: { questions: { label: string; onClick: () => void }[]; onEdit: () => void }) {
  const { t } = useT();
  return (
    <div className="space-y-3 rounded-2xl border-2 border-primary/40 bg-primary-soft/50 p-4" role="status">
      <p className="flex items-start gap-2 text-lg font-bold">
        <Sparkles className="mt-1 size-5 shrink-0 text-primary" aria-hidden /> {t("easy.ai.ready")}
      </p>
      <p className="text-base text-muted-foreground">{t("easy.ai.ready_note")}</p>
      {questions.length ? (
        <div className="space-y-2">
          <p className="text-base font-semibold">{t("easy.ai.missing")}</p>
          <ul className="flex flex-wrap gap-2">
            {questions.map((q) => (
              <li key={q.label}>
                <button type="button" onClick={q.onClick} className="min-h-12 rounded-xl border border-warning/50 bg-card px-3 text-left text-base font-medium hover:border-primary">
                  {q.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <button type="button" onClick={onEdit} className="inline-flex min-h-12 items-center gap-2 text-base font-semibold text-primary hover:underline">
        <PenLine className="size-4" aria-hidden /> {t("easy.wizard.change")}
      </button>
    </div>
  );
}
