"use client";

import { useMemo, useState, useTransition } from "react";
import { Plus, Search, X } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { Constants, type Enums } from "@/types/database.types";
import type { Language } from "@/lib/reference";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import { createCustomSkill } from "../actions";
import type { SkillOption } from "../types";
import { errorMessage } from "./wizard-shell";

export type SelectedSkill = { skill_id: string; level: Enums<"skill_level"> };
export type SelectedLanguage = { language_code: string; level: Enums<"language_level"> };

const SUGGESTED_LIMIT = 24;
const SEARCH_LIMIT = 30;
const DEFAULT_SKILL_LEVEL: Enums<"skill_level"> = "good";

/**
 * Ko'nikma tanlash: kategoriya bo'yicha tavsiyalar + qidiruv + o'z ko'nikmasini qo'shish.
 * Tanlangan har bir ko'nikma uchun daraja (beginner..professional).
 */
export function SkillPicker({
  options,
  categoryId,
  value,
  onChange,
  extraNames,
  invalid,
}: {
  options: SkillOption[];
  categoryId: string | null;
  value: SelectedSkill[];
  onChange: (next: SelectedSkill[]) => void;
  /** Ro'yxatda bo'lmagan (masalan, tasdiqlanmagan) tanlangan ko'nikmalarning nomlari */
  extraNames: Record<string, { name_uz: string; name_ru: string }>;
  invalid?: boolean;
}) {
  const { t, tEnum, name, locale } = useT();
  const [custom, setCustom] = useState<SkillOption[]>([]);
  const [query, setQuery] = useState("");
  const [creating, startCreate] = useTransition();

  const all = useMemo(() => [...custom, ...options], [custom, options]);
  const names = useMemo(() => {
    const m = new Map<string, { name_uz: string; name_ru: string }>();
    for (const [id, n] of Object.entries(extraNames)) m.set(id, n);
    for (const s of all) m.set(s.id, s);
    return m;
  }, [all, extraNames]);
  const selectedIds = useMemo(() => new Set(value.map((v) => v.skill_id)), [value]);

  const suggested = useMemo(() => {
    const specific = categoryId ? all.filter((s) => s.category_id === categoryId) : [];
    const general = all.filter((s) => s.category_id === null);
    return [...specific, ...general].slice(0, SUGGESTED_LIMIT);
  }, [all, categoryId]);

  const q = query.trim().toLowerCase();
  const results = useMemo(() => {
    if (!q) return [];
    return all.filter((s) => s.name_uz.toLowerCase().includes(q) || s.name_ru.toLowerCase().includes(q)).slice(0, SEARCH_LIMIT);
  }, [all, q]);
  const exactExists = results.some((s) => s.name_uz.toLowerCase() === q || s.name_ru.toLowerCase() === q);

  const toggle = (id: string) => {
    if (selectedIds.has(id)) onChange(value.filter((v) => v.skill_id !== id));
    else onChange([...value, { skill_id: id, level: DEFAULT_SKILL_LEVEL }]);
  };
  const setLevel = (id: string, level: Enums<"skill_level">) => onChange(value.map((v) => (v.skill_id === id ? { ...v, level } : v)));

  const addCustom = () => {
    const skillName = query.trim();
    if (skillName.length < 2) return;
    startCreate(async () => {
      const res = await createCustomSkill({ name: skillName, category_id: categoryId });
      if (!res.ok || !res.data) {
        toast.error(errorMessage(t, res.ok ? "generic" : res.error));
        return;
      }
      const skill = res.data.skill;
      setCustom((prev) => (prev.some((s) => s.id === skill.id) ? prev : [skill, ...prev]));
      if (!selectedIds.has(skill.id)) onChange([...value, { skill_id: skill.id, level: DEFAULT_SKILL_LEVEL }]);
      setQuery("");
      toast.success(t("onboarding.worker.skills.custom_added"));
    });
  };

  const label = (id: string) => name(names.get(id) ?? null) || (locale === "ru" ? extraNames[id]?.name_ru : extraNames[id]?.name_uz) || "…";

  return (
    <div className="space-y-4">
      <Input
        type="search"
        leftIcon={<Search />}
        placeholder={t("onboarding.worker.skills.search_placeholder")}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label={t("common.actions.search")}
      />

      {q ? (
        <div className="space-y-3">
          {results.length ? (
            <div className="flex flex-wrap gap-2">
              {results.map((s) => (
                <Chip key={s.id} selected={selectedIds.has(s.id)} onClick={() => toggle(s.id)}>
                  {name(s)}
                </Chip>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t("common.labels.no_results")}</p>
          )}
          {!exactExists && query.trim().length >= 2 ? (
            <Button type="button" variant="soft" size="sm" onClick={addCustom} loading={creating}>
              <Plus className="size-4" />
              {t("onboarding.worker.skills.add_custom", { name: query.trim() })}
            </Button>
          ) : null}
        </div>
      ) : (
        <div>
          <p className="mb-2 text-sm font-medium">{t("onboarding.worker.skills.suggested")}</p>
          <div className={cn("flex flex-wrap gap-2", invalid && "rounded-xl ring-2 ring-destructive/30 ring-offset-2 ring-offset-background")}>
            {suggested.map((s) => (
              <Chip key={s.id} selected={selectedIds.has(s.id)} onClick={() => toggle(s.id)}>
                {name(s)}
              </Chip>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{t("onboarding.worker.skills.search_hint")}</p>
        </div>
      )}

      {value.length ? (
        <div className="rounded-2xl border border-border bg-card">
          <div className="flex items-center justify-between px-4 py-3">
            <p className="text-sm font-semibold">{t("onboarding.worker.skills.selected_title")}</p>
            <span className="text-xs text-muted-foreground">{t("common.labels.selected", { count: value.length })}</span>
          </div>
          <ul className="divide-y divide-border">
            {value.map((v) => (
              <li key={v.skill_id} className="space-y-2 px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[15px] font-medium">{label(v.skill_id)}</span>
                  <button
                    type="button"
                    onClick={() => toggle(v.skill_id)}
                    className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground"
                    aria-label={t("common.actions.delete")}
                  >
                    <X className="size-4" />
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={t("onboarding.worker.skills.level")}>
                  {Constants.public.Enums.skill_level.map((lvl) => (
                    <Chip key={lvl} size="sm" selected={v.level === lvl} onClick={() => setLevel(v.skill_id, lvl)}>
                      {tEnum("skill_level", lvl)}
                    </Chip>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

const DEFAULT_LANGUAGE_LEVEL: Enums<"language_level"> = "b1";

/** Tillar: chip bilan tanlash, har biri uchun daraja */
export function LanguagePicker({
  languages,
  value,
  onChange,
  invalid,
}: {
  languages: Language[];
  value: SelectedLanguage[];
  onChange: (next: SelectedLanguage[]) => void;
  invalid?: boolean;
}) {
  const { t, tEnum, name } = useT();
  const selected = new Map(value.map((v) => [v.language_code, v.level]));
  const levelOptions = Constants.public.Enums.language_level.map((lvl) => ({ value: lvl, label: tEnum("language_level", lvl) }));

  const toggle = (code: string) => {
    if (selected.has(code)) onChange(value.filter((v) => v.language_code !== code));
    else onChange([...value, { language_code: code, level: code === "uz" ? "native" : DEFAULT_LANGUAGE_LEVEL }]);
  };
  const setLevel = (code: string, level: Enums<"language_level">) => onChange(value.map((v) => (v.language_code === code ? { ...v, level } : v)));

  return (
    <div className="space-y-3">
      <div className={cn("flex flex-wrap gap-2", invalid && "rounded-xl ring-2 ring-destructive/30 ring-offset-2 ring-offset-background")}>
        {languages.map((l) => (
          <Chip key={l.code} selected={selected.has(l.code)} onClick={() => toggle(l.code)}>
            {name(l)}
          </Chip>
        ))}
      </div>
      {value.length ? (
        <ul className="space-y-2">
          {value.map((v) => {
            const lang = languages.find((l) => l.code === v.language_code);
            return (
              <li key={v.language_code} className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2">
                <span className="min-w-0 flex-1 truncate text-[15px] font-medium">{lang ? name(lang) : v.language_code}</span>
                <div className="w-44 shrink-0">
                  <Select
                    aria-label={t("onboarding.worker.skills.level")}
                    options={levelOptions}
                    value={v.level}
                    onChange={(e) => setLevel(v.language_code, e.target.value as Enums<"language_level">)}
                    className="h-10 text-sm"
                  />
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
