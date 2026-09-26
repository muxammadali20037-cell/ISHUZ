"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Plus, X, Star } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Chip } from "@/components/ui/chip";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/misc";
import { toast } from "@/components/ui/toast";
import { addCustomSkill } from "../../../actions";
import { MAX_SKILLS } from "../../../schema";
import { errorMessage } from "../../../utils";
import { useSaveStep } from "../use-save-step";
import { WizardFooter } from "../wizard-footer";
import type { SkillsStepProps } from "../types";

interface SkillOption {
  id: string;
  name_uz: string;
  name_ru: string;
}
type Selected = SkillOption & { isRequired: boolean };

function useDebounced(value: string, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

const safe = (q: string) => q.replace(/[,()%*\\"]/g, " ").trim();

/**
 * 7-qadam: tavsiya etilgan ko'nikmalar (kategoriya bo'yicha) + barcha tasdiqlangan ko'nikmalarni qidirish + o'zingiz qo'shish.
 * Tanlangan chipga bosish: majburiy ↔ afzallik; × — olib tashlash.
 */
export function StepSkills({ mode, vacancy, suggestedSkills }: SkillsStepProps) {
  const { t, name } = useT();
  const saver = useSaveStep(mode, vacancy.id, "skills");
  const [selected, setSelected] = useState<Selected[]>(() => vacancy.skills.map((s) => ({ id: s.skill_id, name_uz: s.name_uz, name_ru: s.name_ru, isRequired: s.is_required })));
  const [query, setQuery] = useState("");
  const [custom, setCustom] = useState("");
  const [adding, startAdd] = useTransition();
  const q = useDebounced(query.trim(), 300);
  const selectedIds = useMemo(() => new Set(selected.map((s) => s.id)), [selected]);

  const search = useQuery({
    queryKey: ["vacancy-skill-search", q],
    enabled: q.length >= 2,
    queryFn: async (): Promise<SkillOption[]> => {
      const needle = safe(q);
      if (!needle) return [];
      const { data, error } = await createClient()
        .from("skills")
        .select("id, name_uz, name_ru")
        .eq("is_approved", true)
        .or(`name_uz.ilike.*${needle}*,name_ru.ilike.*${needle}*`)
        .order("usage_count", { ascending: false })
        .limit(20);
      if (error) throw new Error(error.message);
      return data;
    },
  });

  const add = (s: SkillOption, isRequired = true) => {
    if (selectedIds.has(s.id)) return;
    if (selected.length >= MAX_SKILLS) {
      toast.error(t("vacancies.errors.skill_limit", { max: MAX_SKILLS }));
      return;
    }
    setSelected((prev) => [...prev, { ...s, isRequired }]);
  };
  const toggleRequired = (id: string) => setSelected((prev) => prev.map((s) => (s.id === id ? { ...s, isRequired: !s.isRequired } : s)));
  const remove = (id: string) => setSelected((prev) => prev.filter((s) => s.id !== id));

  const addCustom = () => {
    const value = custom.trim();
    if (value.length < 2) {
      toast.error(t("vacancies.errors.skill_name"));
      return;
    }
    startAdd(async () => {
      const res = await addCustomSkill({ name: value, categoryId: vacancy.category_id });
      if (!res.ok || !res.data) {
        toast.error(errorMessage(t, res.ok ? "generic" : res.error));
        return;
      }
      add(res.data);
      setCustom("");
      toast.success(t(res.data.existed ? "vacancies.toast.skill_exists" : "vacancies.toast.skill_added"));
    });
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    saver.save({ step: "skills", data: { skills: selected.map((s) => ({ skillId: s.id, isRequired: s.isRequired })) } });
  };

  const suggestions = suggestedSkills.filter((s) => !selectedIds.has(s.id)).slice(0, 24);
  const results = (search.data ?? []).filter((s) => !selectedIds.has(s.id));

  return (
    <form onSubmit={submit} noValidate className="space-y-6">
      <section>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-medium">{t("vacancies.wizard.skills.selected", { count: selected.length })}</span>
          {selected.length ? <span className="text-xs text-muted-foreground">{t("vacancies.wizard.skills.toggle_hint")}</span> : null}
        </div>
        {selected.length ? (
          <div className="flex flex-wrap gap-2">
            {selected.map((s) => (
              <span key={s.id} className={cn("inline-flex h-11 items-center gap-1 rounded-full border pl-1 pr-1 text-sm font-medium", s.isRequired ? "border-primary bg-primary text-primary-foreground" : "border-primary/40 bg-primary-soft text-primary")}>
                <button type="button" onClick={() => toggleRequired(s.id)} className="inline-flex h-9 items-center gap-1.5 rounded-full px-3" title={t(s.isRequired ? "vacancies.wizard.skills.required" : "vacancies.wizard.skills.preferred")}>
                  {s.isRequired ? null : <Star className="size-3.5" />}
                  {name(s)}
                  <span className={cn("rounded-md px-1.5 text-[10px] uppercase", s.isRequired ? "bg-primary-foreground/20" : "bg-primary/10")}>{t(s.isRequired ? "vacancies.wizard.skills.required" : "vacancies.wizard.skills.preferred")}</span>
                </button>
                <button type="button" onClick={() => remove(s.id)} className="flex size-8 items-center justify-center rounded-full hover:bg-black/10" aria-label={t("vacancies.actions.remove")}>
                  <X className="size-4" />
                </button>
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{t("vacancies.wizard.skills.none_selected")}</p>
        )}
      </section>

      {suggestions.length ? (
        <section>
          <div className="mb-2 text-sm font-medium">{t("vacancies.wizard.skills.suggested")}</div>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <Chip key={s.id} size="lg" onClick={() => add(s)} icon={<Plus />}>
                {name(s)}
              </Chip>
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <div className="mb-2 text-sm font-medium">{t("vacancies.wizard.skills.search")}</div>
        <Input leftIcon={<Search />} value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("vacancies.wizard.skills.search_placeholder")} aria-label={t("vacancies.wizard.skills.search")} />
        {q.length >= 2 ? (
          <div className="mt-3">
            {search.isPending ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Spinner className="size-4" /> {t("vacancies.wizard.skills.searching")}
              </div>
            ) : search.isError ? (
              <p className="text-sm text-destructive">{t("vacancies.errors.load_failed")}</p>
            ) : results.length ? (
              <div className="flex flex-wrap gap-2">
                {results.map((s) => (
                  <Chip key={s.id} size="lg" onClick={() => add(s)} icon={<Plus />}>
                    {name(s)}
                  </Chip>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{t("vacancies.wizard.skills.no_results")}</p>
            )}
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl border border-dashed border-border p-4">
        <div className="mb-2 text-sm font-medium">{t("vacancies.wizard.skills.add_custom")}</div>
        <div className="flex gap-2">
          <Input value={custom} onChange={(e) => setCustom(e.target.value)} maxLength={60} placeholder={t("vacancies.wizard.skills.custom_placeholder")} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } }} />
          <Button type="button" variant="secondary" onClick={addCustom} loading={adding} disabled={custom.trim().length < 2}>
            <Plus className="size-4" /> {t("vacancies.actions.add")}
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{t("vacancies.wizard.skills.custom_note")}</p>
      </section>

      <WizardFooter mode={mode} step="skills" pending={saver.pending} onBack={saver.back} onSkip={saver.skip} />
    </form>
  );
}
