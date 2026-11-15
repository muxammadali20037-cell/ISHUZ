"use client";

import { PenLine, Sparkles } from "lucide-react";
import { useT } from "@/lib/i18n/client";

/** Tekshirish sahifasida: "AI e'loningizni tayyorladi…" + yetishmayotgan ma'lumot uchun qisqa savollar */
export function AiReadyBanner({ questions, onEdit }: { questions: { label: string; onClick: () => void }[]; onEdit: () => void }) {
  const { t } = useT();
  return (
    <div className="space-y-3 rounded-2xl border-2 border-primary/40 bg-primary-soft/50 p-4" role="status">
      <p className="flex items-start gap-2 text-lg font-bold">
        <Sparkles className="mt-1 size-5 shrink-0 text-primary-ink" aria-hidden /> {t("easy.ai.ready")}
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
      <button type="button" onClick={onEdit} className="inline-flex min-h-12 items-center gap-2 text-base font-semibold text-primary-ink hover:underline">
        <PenLine className="size-4" aria-hidden /> {t("easy.wizard.change")}
      </button>
    </div>
  );
}
