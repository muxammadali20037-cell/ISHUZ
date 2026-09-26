"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Search, X } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { createClient } from "@/lib/supabase/client";
import type { Skill } from "@/lib/reference";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import { Spinner } from "@/components/ui/misc";
import { Constants, type Enums } from "@/types/database.types";
import { createCustomSkill, updateSkills } from "../../actions";
import { MAX_SKILLS } from "../../schema";
import { useAction } from "../use-action";
import { EditSectionCard } from "./section-card";

type SkillLite = { id: string; name_uz: string; name_ru: string };
type Selected = SkillLite & { level: Enums<"skill_level"> };

function sanitize(q: string) {
  return q.replace(/[%,()\\]/g, "").trim();
}

export function SkillsForm({ initial, suggested, categoryId }: { initial: Selected[]; suggested: Skill[]; categoryId: string | null }) {
  const { t, tEnum, name } = useT();
  const { pending, run } = useAction();
  const [selected, setSelected] = useState<Selected[]>(initial);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const q = sanitize(query);
  const selectedIds = useMemo(() => new Set(selected.map((s) => s.id)), [selected]);

  const search = useQuery({
    queryKey: ["skills-search", q],
    enabled: q.length >= 2,
    queryFn: async () => {
      const { data, error } = await createClient()
        .from("skills")
        .select("id, slug, name_uz, name_ru")
        .eq("is_approved", true)
        .or(`name_uz.ilike.%${q}%,name_ru.ilike.%${q}%`)
        .order("usage_count", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
  });

  const add = (s: SkillLite) => {
    if (selectedIds.has(s.id)) {
      toast.info(t("profile.errors.skill_exists"));
      return;
    }
    if (selected.length >= MAX_SKILLS) {
      toast.error(t("profile.errors.max_skills", { max: MAX_SKILLS }));
      return;
    }
    setSelected([...selected, { id: s.id, name_uz: s.name_uz, name_ru: s.name_ru, level: "good" }]);
    setQuery("");
  };

  const setLevel = (id: string, level: Enums<"skill_level">) => setSelected(selected.map((s) => (s.id === id ? { ...s, level } : s)));
  const remove = (id: string) => setSelected(selected.filter((s) => s.id !== id));

  const results = (search.data ?? []).filter((s) => !selectedIds.has(s.id));
  const exactExists = (search.data ?? []).some((s) => s.name_uz.toLowerCase() === q.toLowerCase() || s.name_ru.toLowerCase() === q.toLowerCase());
  const suggestions = suggested.filter((s) => !selectedIds.has(s.id)).slice(0, 24);

  const createCustom = async () => {
    setCreating(true);
    const res = await createCustomSkill({ name: q, category_id: categoryId });
    setCreating(false);
    if (!res.ok) {
      toast.error(t(`common.errors.${res.error}`));
      return;
    }
    if (res.data) add(res.data);
  };

  const levelOptions = Constants.public.Enums.skill_level.map((l) => ({ value: l, label: tEnum("skill_level", l) }));

  return (
    <EditSectionCard
      id="skills"
      title={t("profile.sections.skills")}
      footer={
        <Button type="button" loading={pending} onClick={() => run(() => updateSkills({ skills: selected.map((s) => ({ skill_id: s.id, level: s.level })) }))}>
          {t("common.actions.save")}
        </Button>
      }
    >
      <Field label={t("profile.labels.skill_search")} htmlFor="skill-search">
        <Input
          id="skill-search"
          leftIcon={<Search />}
          placeholder={t("profile.labels.skill_search_placeholder")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          maxLength={60}
          rightSlot={search.isFetching ? <Spinner className="size-4" /> : undefined}
        />
      </Field>
      {q.length >= 2 ? (
        <div className="flex flex-wrap gap-2">
          {results.map((s) => (
            <Chip key={s.id} size="sm" icon={<Plus />} onClick={() => add(s)}>
              {name(s)}
            </Chip>
          ))}
          {!search.isFetching && !exactExists ? (
            <Button type="button" size="sm" variant="soft" loading={creating} onClick={createCustom}>
              <Plus className="size-4" /> {t("profile.labels.skill_add_custom", { name: q })}
            </Button>
          ) : null}
          {!exactExists ? <p className="w-full text-xs text-muted-foreground">{t("profile.labels.skill_custom_hint")}</p> : null}
        </div>
      ) : suggestions.length ? (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("profile.labels.skill_suggested")}</p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <Chip key={s.id} size="sm" icon={<Plus />} onClick={() => add(s)}>
                {name(s)}
              </Chip>
            ))}
          </div>
        </div>
      ) : null}

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t("profile.labels.skill_selected")} · {selected.length}/{MAX_SKILLS}
        </p>
        {selected.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("profile.empty.skills")}</p>
        ) : (
          <ul className="divide-y divide-border">
            {selected.map((s) => (
              <li key={s.id} className="flex items-center gap-2 py-2">
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{name(s)}</span>
                <Select aria-label={t("profile.labels.level")} options={levelOptions} value={s.level} onChange={(e) => setLevel(s.id, e.target.value as Enums<"skill_level">)} className="h-10 w-40 text-sm" />
                <Button type="button" variant="ghost" size="icon-sm" aria-label={t("common.actions.delete")} onClick={() => remove(s.id)}>
                  <X className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </EditSectionCard>
  );
}
