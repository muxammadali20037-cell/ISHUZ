"use client";

import { useMemo, useState } from "react";
import { Check } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import type { Category, Subcategory } from "@/lib/reference";
import { Button } from "@/components/ui/button";
import { ChipGroup } from "@/components/ui/chip";
import { Field } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { CategoryIcon } from "@/components/shared/category-icon";
import { cn } from "@/lib/utils";
import { Constants, type Enums } from "@/types/database.types";
import { updateCategory } from "../../actions";
import { useAction } from "../use-action";
import { EditSectionCard } from "./section-card";

export function CategoryForm({
  categories,
  subcategories,
  initial,
}: {
  categories: Category[];
  subcategories: Subcategory[];
  initial: { category_id: string | null; subcategory_id: string | null; experience_level: Enums<"experience_level"> };
}) {
  const { t, tEnum, name } = useT();
  const { pending, run } = useAction();
  const [categoryId, setCategoryId] = useState(initial.category_id ?? "");
  const [subcategoryId, setSubcategoryId] = useState(initial.subcategory_id ?? "");
  const [level, setLevel] = useState<Enums<"experience_level">>(initial.experience_level);
  const subs = useMemo(() => subcategories.filter((s) => s.category_id === categoryId), [subcategories, categoryId]);

  return (
    <EditSectionCard
      id="category"
      title={t("profile.sections.category")}
      description={t("profile.edit.category_hint")}
      footer={
        <Button type="button" loading={pending} disabled={!categoryId} onClick={() => run(() => updateCategory({ category_id: categoryId, subcategory_id: subcategoryId || null, experience_level: level }))}>
          {t("common.actions.save")}
        </Button>
      }
    >
      <Field label={t("profile.labels.category")} required>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" role="radiogroup">
          {categories.map((c) => {
            const selected = c.id === categoryId;
            return (
              <button
                key={c.id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => {
                  setCategoryId(c.id);
                  if (c.id !== categoryId) setSubcategoryId("");
                }}
                className={cn(
                  "relative flex min-h-12 items-center gap-2.5 rounded-xl border p-2.5 text-left text-sm font-medium transition-colors",
                  selected ? "border-primary bg-primary-soft text-primary" : "border-border bg-card hover:border-primary/40 hover:bg-secondary",
                )}
              >
                <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", selected ? "bg-primary text-primary-foreground" : "bg-primary-soft text-primary")}>
                  <CategoryIcon name={c.icon} className="size-4.5" />
                </span>
                <span className="min-w-0 flex-1 leading-tight">{name(c)}</span>
                {selected ? <Check className="size-4 shrink-0" strokeWidth={3} /> : null}
              </button>
            );
          })}
        </div>
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("profile.labels.subcategory")} htmlFor="subcategory" hint={t("profile.labels.optional")}>
          <Select
            id="subcategory"
            placeholder={t("profile.labels.select_placeholder")}
            options={subs.map((s) => ({ value: s.id, label: name(s) }))}
            value={subcategoryId}
            onChange={(e) => setSubcategoryId(e.target.value)}
            disabled={!categoryId || subs.length === 0}
          />
        </Field>
      </div>
      <Field label={t("profile.labels.experience_level")}>
        <ChipGroup
          size="sm"
          options={Constants.public.Enums.experience_level.map((v) => ({ value: v, label: tEnum("experience_level", v) }))}
          value={level}
          onChange={(v) => v && !Array.isArray(v) && setLevel(v)}
        />
      </Field>
    </EditSectionCard>
  );
}
