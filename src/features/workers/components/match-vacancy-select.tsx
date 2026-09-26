"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useT } from "@/lib/i18n/client";
import { Select } from "@/components/ui/select";
import type { MyVacancy } from "../types";

/** Nomzod sahifasida: "Vakansiya bo'yicha moslikni ko'rish" — tanlov ?vacancy= bilan navigatsiya qiladi */
export function MatchVacancySelect({ workerId, vacancies, current }: { workerId: string; vacancies: MyVacancy[]; current: string | null }) {
  const { t } = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const options = vacancies.map((v) => ({ value: v.id, label: v.title }));
  return (
    <Select
      aria-label={t("workers.candidate.match_select")}
      placeholder={current ? t("workers.candidate.match_none") : t("workers.candidate.match_select_placeholder")}
      options={options}
      value={current ?? ""}
      disabled={pending}
      onChange={(e) => {
        const id = e.target.value;
        startTransition(() => router.push(id ? `/workers/${workerId}?vacancy=${id}` : `/workers/${workerId}`, { scroll: false }));
      }}
      className="h-11 text-sm"
    />
  );
}
