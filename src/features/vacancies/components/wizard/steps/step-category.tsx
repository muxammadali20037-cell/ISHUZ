"use client";

import { useMemo, useState } from "react";
import { Search, Check } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { ChipGroup } from "@/components/ui/chip";
import { Field } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { CategoryIcon } from "@/components/shared/category-icon";
import { categorySchema } from "../../../schema";
import { useSaveStep } from "../use-save-step";
import { WizardFooter } from "../wizard-footer";
import type { StepProps } from "../types";

/** 2-qadam: kategoriya (grid + qidiruv) → yo'nalish chiplari */
export function StepCategory({ mode, vacancy, refs }: StepProps) {
  const { t, name } = useT();
  const saver = useSaveStep(mode, vacancy.id, "category");
  const [categoryId, setCategoryId] = useState<string | null>(vacancy.category_id);
  const [subcategoryId, setSubcategoryId] = useState<string | null>(vacancy.subcategory_id);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  const categories = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return refs.categories;
    const subMatch = new Set(refs.subcategories.filter((s) => name(s).toLowerCase().includes(q)).map((s) => s.category_id));
    return refs.categories.filter((c) => name(c).toLowerCase().includes(q) || subMatch.has(c.id));
  }, [query, refs.categories, refs.subcategories, name]);
  const selected = refs.categories.find((c) => c.id === categoryId) ?? null;
  const subcategories = useMemo(() => refs.subcategories.filter((s) => s.category_id === categoryId), [refs.subcategories, categoryId]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = categorySchema.safeParse({ categoryId, subcategoryId });
    if (!parsed.success) {
      setError(t("vacancies.errors.category_required"));
      return;
    }
    setError(null);
    saver.save({ step: "category", data: parsed.data });
  };

  return (
    <form onSubmit={submit} noValidate>
      {selected ? (
        <div className="flex items-center gap-3 rounded-2xl border border-primary bg-primary-soft/60 p-3">
          <span className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <CategoryIcon name={selected.icon} className="size-6" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="font-semibold">{name(selected)}</div>
            <div className="text-xs text-muted-foreground">{t("vacancies.wizard.category.subcategory_hint")}</div>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={() => { setCategoryId(null); setSubcategoryId(null); }}>
            {t("vacancies.wizard.category.change")}
          </Button>
        </div>
      ) : (
        <>
          <Input leftIcon={<Search />} value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("vacancies.wizard.category.search_placeholder")} aria-label={t("vacancies.wizard.category.search")} />
          {error ? <p className="mt-2 text-sm text-destructive" role="alert">{error}</p> : null}
          {categories.length ? (
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => { setCategoryId(c.id); setSubcategoryId(null); setError(null); }}
                  className={cn("flex min-h-[4.5rem] items-center gap-3 rounded-2xl border bg-card p-3 text-left transition-colors hover:border-primary/40 hover:bg-secondary", "border-border")}
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
                    <CategoryIcon name={c.icon} className="size-5" />
                  </span>
                  <span className="text-sm font-medium leading-snug">{name(c)}</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="mt-6 text-center text-sm text-muted-foreground">{t("vacancies.wizard.category.no_results")}</p>
          )}
        </>
      )}

      {selected && subcategories.length ? (
        <Field label={t("vacancies.wizard.category.subcategory")} className="mt-5" hint={t("common.labels.optional")}>
          <ChipGroup
            options={subcategories.map((s) => ({ value: s.id, label: name(s) }))}
            value={subcategoryId}
            onChange={(v) => setSubcategoryId(typeof v === "string" ? v : null)}
            size="lg"
          />
        </Field>
      ) : null}
      {selected && subcategoryId ? (
        <p className="mt-2 inline-flex items-center gap-1 text-xs text-success">
          <Check className="size-3.5" /> {name(subcategories.find((s) => s.id === subcategoryId) ?? null)}
        </p>
      ) : null}

      <WizardFooter mode={mode} step="category" pending={saver.pending} onBack={saver.back} />
    </form>
  );
}
