"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n/client";
import { createVacancyFromText } from "../actions";
import { AiComposer } from "./ai-composer";

/** Ish beruvchi: erkin matn → AI to'ldirgan qoralama → tekshiruv sahifasi (o'sha yerda tahrirlanadi va e'lon qilinadi) */
export function VacancyAiComposer() {
  const { t } = useT();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [pending, startTransition] = useTransition();

  const submit = (value: string) => {
    setText(value);
    setError(null);
    startTransition(async () => {
      const res = await createVacancyFromText({ text: value });
      if (!res.ok || !res.data) {
        const code = res.ok ? "ai_failed" : res.error;
        const key = `ai.errors.${code}`;
        const msg = t(key);
        setError(msg === key ? t("common.errors.generic") : msg);
        return;
      }
      router.push(res.data.redirect);
    });
  };

  return (
    <AiComposer
      title={t("ai.employer.title")}
      subtitle={t("ai.employer.subtitle")}
      placeholder={t("ai.employer.placeholder")}
      hints={t("ai.employer.hints")}
      pending={pending}
      error={error}
      initialText={text}
      manualHref="/employer/vacancies/new"
      manualLabel={t("ai.employer.manual")}
      onSubmit={submit}
    />
  );
}
