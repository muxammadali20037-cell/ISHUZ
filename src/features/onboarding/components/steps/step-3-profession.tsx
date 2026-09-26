"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Pencil, Search } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import type { Category, Subcategory } from "@/lib/reference";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ChipGroup } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { CategoryIcon } from "@/components/shared/category-icon";
import { saveProfession } from "../../actions";
import { professionSchema, type ProfessionInput } from "../../schema";
import { WizardFooter, fieldError, singleValue, useStepSubmit } from "../wizard-shell";

export interface ProfessionDraft {
  category_id: string | null;
  subcategory_id: string | null;
  headline: string | null;
}

export function Step3Profession({ draft, categories, subcategories }: { draft: ProfessionDraft; categories: Category[]; subcategories: Subcategory[] }) {
  const { t, name } = useT();
  const { pending, submit } = useStepSubmit();
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<ProfessionInput>({
    resolver: zodResolver(professionSchema),
    defaultValues: { category_id: draft.category_id ?? "", subcategory_id: draft.subcategory_id, headline: draft.headline ?? "" },
  });
  const categoryId = watch("category_id");
  const subcategoryId = watch("subcategory_id");
  const [browsing, setBrowsing] = useState(!draft.category_id);
  const [query, setQuery] = useState("");
  const [autoHeadline, setAutoHeadline] = useState<string | null>(null);

  const selected = categories.find((c) => c.id === categoryId) ?? null;
  const subs = useMemo(() => subcategories.filter((s) => s.category_id === categoryId), [subcategories, categoryId]);
  const q = query.trim().toLowerCase();
  const matches = (row: { name_uz: string; name_ru: string }) => row.name_uz.toLowerCase().includes(q) || row.name_ru.toLowerCase().includes(q);
  const visible = useMemo(() => {
    if (!q) return categories.map((c) => ({ category: c, hits: [] as Subcategory[] }));
    return categories
      .map((c) => ({ category: c, hits: subcategories.filter((s) => s.category_id === c.id && matches(s)) }))
      .filter(({ category, hits }) => matches(category) || hits.length > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- matches() faqat q ga bog'liq
  }, [categories, subcategories, q]);

  const pickCategory = (id: string, subId: string | null = null) => {
    setValue("category_id", id, { shouldValidate: true });
    setValue("subcategory_id", null);
    setBrowsing(false);
    setQuery("");
    if (subId) pickSubcategory(subId, subcategories.filter((s) => s.category_id === id));
  };
  const pickSubcategory = (id: string | null, list: Subcategory[] = subs) => {
    setValue("subcategory_id", id);
    const sub = list.find((s) => s.id === id);
    const current = getValues("headline").trim();
    if (sub && (!current || current === autoHeadline)) {
      const label = name(sub);
      setValue("headline", label, { shouldValidate: true });
      setAutoHeadline(label);
    }
  };

  return (
    <form noValidate onSubmit={handleSubmit((values) => submit(() => saveProfession(values)))} className="space-y-6">
      {selected && !browsing ? (
        <div className="flex items-center gap-3 rounded-2xl border border-primary/40 bg-primary-soft/50 p-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <CategoryIcon name={selected.icon} className="size-6" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-wide text-primary">{t("onboarding.worker.profession.category")}</p>
            <p className="truncate text-base font-semibold">{name(selected)}</p>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={() => setBrowsing(true)}>
            <Pencil className="size-4" />
            {t("common.actions.edit")}
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <Input type="search" leftIcon={<Search />} placeholder={t("onboarding.worker.profession.search_placeholder")} value={query} onChange={(e) => setQuery(e.target.value)} aria-label={t("common.actions.search")} />
          {fieldError(t, errors.category_id) ? (
            <p className="text-sm text-destructive" role="alert">
              {fieldError(t, errors.category_id)}
            </p>
          ) : null}
          {visible.length ? (
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3" role="radiogroup" aria-label={t("onboarding.worker.profession.category")}>
              {visible.map(({ category: c, hits }) => {
                const active = c.id === categoryId;
                return (
                  <button
                    key={c.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => pickCategory(c.id, hits.length === 1 ? (hits[0]?.id ?? null) : null)}
                    className={cn(
                      "flex min-h-[72px] items-center gap-3 rounded-2xl border bg-card p-3 text-left transition-colors",
                      active ? "border-primary bg-primary-soft/50" : "border-border hover:border-primary/40 hover:bg-secondary/60",
                    )}
                  >
                    <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", active ? "bg-primary text-primary-foreground" : "bg-primary-soft text-primary")}>
                      {active ? <Check className="size-5" strokeWidth={3} /> : <CategoryIcon name={c.icon} className="size-5" />}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium leading-tight">{name(c)}</span>
                      {hits.length ? <span className="mt-0.5 block truncate text-xs text-muted-foreground">{hits.slice(0, 3).map((h) => name(h)).join(" · ")}</span> : null}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">{t("common.labels.no_results")}</p>
          )}
        </div>
      )}

      {selected && !browsing ? (
        <>
          {subs.length ? (
            <Field label={t("onboarding.worker.profession.subcategory")} description={t("onboarding.worker.profession.subcategory_hint")}>
              <ChipGroup options={subs.map((s) => ({ value: s.id, label: name(s) }))} value={subcategoryId} onChange={(v) => pickSubcategory(singleValue(v) ?? null)} />
            </Field>
          ) : null}
          <Field label={t("onboarding.worker.profession.headline")} htmlFor="headline" required error={fieldError(t, errors.headline)} description={t("onboarding.worker.profession.headline_hint")}>
            <Input id="headline" placeholder={t("onboarding.worker.profession.headline_placeholder")} maxLength={80} invalid={!!errors.headline} {...register("headline")} />
          </Field>
        </>
      ) : null}

      <WizardFooter step={3} pending={pending} />
    </form>
  );
}
