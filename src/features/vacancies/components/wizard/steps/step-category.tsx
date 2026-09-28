"use client";

import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n/client";
import { ProfessionPicker } from "@/features/professions/components/profession-picker";
import type { PickedProfession, TrailItem } from "@/features/professions/types";
import { categorySchema } from "../../../schema";
import { useSaveStep } from "../use-save-step";
import { WizardFooter } from "../wizard-footer";
import type { StepProps } from "../types";

/**
 * 2-qadam: aniq kasb (ishchilar bilan bir xil kasblar daraxti). Qidiruv vakansiya nomi bilan oldindan to'ldiriladi:
 * "Urolog kerak" → darhol "Tibbiyot › Shifokorlar › Urologiya › Urolog".
 */
export function StepCategory({ mode, vacancy, refs }: StepProps) {
  const { t } = useT();
  const saver = useSaveStep(mode, vacancy.id, "category");
  const [picked, setPicked] = useState<PickedProfession | null>(null);
  const [loadingTrail, setLoadingTrail] = useState(!!vacancy.profession_node_id);
  const [error, setError] = useState<string | null>(null);

  // Tahrirlashda: saqlangan kasbning yo'lini yuklash
  useEffect(() => {
    if (!vacancy.profession_node_id || !vacancy.category_id) return;
    let cancelled = false;
    fetch(`/api/professions/trail?id=${vacancy.profession_node_id}`)
      .then((r) => r.json())
      .then(({ trail }: { trail: TrailItem[] }) => {
        if (!cancelled && trail?.length) setPicked({ id: vacancy.profession_node_id!, categoryId: vacancy.category_id!, trail });
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoadingTrail(false));
    return () => {
      cancelled = true;
    };
  }, [vacancy.profession_node_id, vacancy.category_id]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = categorySchema.safeParse({ categoryId: picked?.categoryId ?? null, subcategoryId: null, professionNodeId: picked?.id ?? null });
    if (!parsed.success || !picked) {
      setError(t("professions.pick_required"));
      return;
    }
    setError(null);
    saver.save({ step: "category", data: parsed.data });
  };

  return (
    <form onSubmit={submit} noValidate>
      {loadingTrail ? (
        <div className="space-y-2" aria-busy>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-2xl bg-secondary" />
          ))}
        </div>
      ) : (
        <ProfessionPicker
          categories={refs.categories}
          value={picked}
          onChange={(p) => {
            setPicked(p);
            setError(null);
          }}
          title={t("professions.employer_title")}
          subtitle={t("professions.employer_sub")}
          initialQuery={vacancy.profession_node_id ? "" : (vacancy.title ?? "").replace(/\b(kerak|требуется|нужен|нужна|needed|wanted)\b/gi, "").trim()}
        />
      )}
      {error ? (
        <p className="mt-3 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <WizardFooter mode={mode} step="category" pending={saver.pending} onBack={saver.back} />
    </form>
  );
}
