"use client";

import { useMemo, useState, type ReactNode } from "react";
import { LocateFixed, Search, X } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { formatMoneyShort } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Category, District, Language, Region, Subcategory } from "@/lib/reference";
import { CategoryIcon } from "@/components/shared/category-icon";
import { Dialog, Sheet } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Chip, ChipGroup } from "@/components/ui/chip";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { Enums } from "@/types/database.types";
import {
  AVAILABILITIES,
  DEFAULT_STATUSES,
  EDUCATION_LEVELS,
  EMPLOYMENT_TYPES,
  EMPTY_WORKER_SEARCH,
  EXPERIENCE_MIN_OPTIONS,
  GENDERS,
  MAX_KM_OPTIONS,
  SALARY_MAX_PRESETS,
  SCHEDULES,
  WORKER_STATUSES,
  type WorkerSearchParams,
} from "../search-params";
import type { SkillOption } from "../types";
import { useGeolocate } from "./use-geolocate";

export type SheetKind = "category" | "region" | "experience" | "salary" | "schedule" | "all";

export interface FilterReference {
  categories: Category[];
  subcategories: Subcategory[];
  regions: Region[];
  districts: Pick<District, "id" | "region_id" | "name_uz" | "name_ru">[];
  languages: Language[];
  skills: SkillOption[];
}

type Patch = (p: Partial<WorkerSearchParams>) => void;
interface SectionProps {
  draft: WorkerSearchParams;
  patch: Patch;
  reference: FilterReference;
}

function SectionTitle({ children, className }: { children: ReactNode; className?: string }) {
  return <h3 className={cn("mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground", className)}>{children}</h3>;
}

// ---------------------------------------------------------------------------
// Bo'limlar
// ---------------------------------------------------------------------------

function CategorySection({ draft, patch, reference }: SectionProps) {
  const { t, name } = useT();
  const selected = reference.categories.find((c) => c.slug === draft.category) ?? null;
  return (
    <div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {reference.categories.map((c) => {
          const active = c.slug === draft.category;
          return (
            <button
              key={c.id}
              type="button"
              aria-pressed={active}
              onClick={() => patch({ category: active ? null : c.slug, subcategory: null, profession: null })}
              className={cn(
                "flex min-h-11 items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm font-medium transition-colors",
                active ? "border-primary bg-primary-soft text-primary" : "border-border bg-card hover:bg-secondary",
              )}
            >
              <CategoryIcon name={c.icon} className="size-5 shrink-0" />
              <span className="truncate">{name(c)}</span>
            </button>
          );
        })}
      </div>
      {/* Yo'nalishlar endi sahifada katta panelda (har biri nomzodlar soni bilan) */}
      {selected ? <p className="mt-4 rounded-xl bg-primary-soft/60 px-3 py-2 text-sm text-foreground">{t("jobs.directions.sheet_hint")}</p> : null}
    </div>
  );
}

function RegionSection({ draft, patch, reference }: SectionProps) {
  const { t, name } = useT();
  const region = reference.regions.find((r) => r.slug === draft.region) ?? null;
  const districts = region ? reference.districts.filter((d) => d.region_id === region.id) : [];
  return (
    <div className="space-y-4">
      <Select
        aria-label={t("workers.filters.region")}
        placeholder={t("workers.filters.all_regions")}
        options={reference.regions.map((r) => ({ value: r.slug, label: name(r) }))}
        value={draft.region ?? ""}
        onChange={(e) => patch({ region: e.target.value || null, district: [] })}
      />
      {region && districts.length ? (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <SectionTitle className="mb-0">{t("workers.filters.districts")}</SectionTitle>
            {draft.district.length ? (
              <button type="button" className="text-xs font-medium text-primary" onClick={() => patch({ district: [] })}>
                {t("workers.filters.all_districts")}
              </button>
            ) : null}
          </div>
          <ChipGroup
            multiple
            size="sm"
            options={districts.map((d) => ({ value: d.id, label: name(d) }))}
            value={draft.district}
            onChange={(v) => patch({ district: Array.isArray(v) ? v : [] })}
          />
        </div>
      ) : null}
    </div>
  );
}

function ExperienceSection({ draft, patch }: SectionProps) {
  const { t } = useT();
  const options = EXPERIENCE_MIN_OPTIONS.filter((m) => m > 0).map((m) => ({ value: String(m), label: t(`enums.experience_min_months.${m}`) }));
  return <ChipGroup options={options} value={draft.experience_min ? String(draft.experience_min) : null} onChange={(v) => patch({ experience_min: typeof v === "string" ? Number(v) : null })} />;
}

function SalarySection({ draft, patch }: SectionProps) {
  const { t, locale } = useT();
  const options = SALARY_MAX_PRESETS.map((n) => ({ value: String(n), label: t("workers.filters.salary_up_to", { amount: formatMoneyShort(n, locale) }) }));
  return <ChipGroup options={options} value={draft.salary_max ? String(draft.salary_max) : null} onChange={(v) => patch({ salary_max: typeof v === "string" ? Number(v) : null })} />;
}

function ScheduleSection({ draft, patch }: SectionProps) {
  const { t, tEnum } = useT();
  return (
    <div className="space-y-4">
      <div>
        <SectionTitle>{t("workers.filters.schedule")}</SectionTitle>
        <ChipGroup multiple options={SCHEDULES.map((s) => ({ value: s, label: tEnum("work_schedule", s) }))} value={draft.schedule} onChange={(v) => patch({ schedule: Array.isArray(v) ? v : [] })} />
      </div>
      <div>
        <SectionTitle>{t("workers.filters.employment")}</SectionTitle>
        <ChipGroup multiple options={EMPLOYMENT_TYPES.map((s) => ({ value: s, label: tEnum("employment_type", s) }))} value={draft.employment} onChange={(v) => patch({ employment: Array.isArray(v) ? v : [] })} />
      </div>
    </div>
  );
}

function PersonSection({ draft, patch }: SectionProps) {
  const { t, tEnum } = useT();
  return (
    <div className="space-y-4">
      <div>
        <SectionTitle>{t("workers.filters.format")}</SectionTitle>
        <ChipGroup
          options={(["official", "unofficial"] as Enums<"work_format">[]).map((f) => ({ value: f, label: tEnum("work_format", f) }))}
          value={draft.format === "any" ? null : draft.format}
          onChange={(v) => patch({ format: typeof v === "string" ? v : null })}
        />
      </div>
      <div>
        <SectionTitle>{t("workers.filters.gender")}</SectionTitle>
        <ChipGroup options={GENDERS.map((g) => ({ value: g, label: tEnum("gender", g) }))} value={draft.gender} onChange={(v) => patch({ gender: typeof v === "string" ? v : null })} />
      </div>
      <div>
        <SectionTitle>{t("workers.filters.education")}</SectionTitle>
        <ChipGroup size="sm" options={EDUCATION_LEVELS.map((e) => ({ value: e, label: tEnum("education_level", e) }))} value={draft.education_min} onChange={(v) => patch({ education_min: typeof v === "string" ? v : null })} />
      </div>
    </div>
  );
}

function LanguagesSection({ draft, patch, reference }: SectionProps) {
  const { name } = useT();
  return (
    <ChipGroup
      multiple
      size="sm"
      options={reference.languages.map((l) => ({ value: l.code, label: name(l) }))}
      value={draft.languages}
      onChange={(v) => patch({ languages: Array.isArray(v) ? v : [] })}
    />
  );
}

function SkillsSection({ draft, patch, reference }: SectionProps) {
  const { t, name, locale } = useT();
  const [query, setQuery] = useState("");
  const category = reference.categories.find((c) => c.slug === draft.category) ?? null;
  const selectedSet = useMemo(() => new Set(draft.skills), [draft.skills]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = (s: SkillOption) => !q || s.name_uz.toLowerCase().includes(q) || s.name_ru.toLowerCase().includes(q);
    const selected = reference.skills.filter((s) => selectedSet.has(s.id));
    const rest = reference.skills.filter((s) => !selectedSet.has(s.id) && matches(s));
    const ranked = category ? [...rest.filter((s) => s.category_id === category.id), ...rest.filter((s) => s.category_id !== category.id)] : rest;
    return [...selected, ...ranked.slice(0, q ? 60 : 40)];
  }, [query, reference.skills, selectedSet, category]);

  const toggle = (id: string) => {
    const next = new Set(draft.skills);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    patch({ skills: [...next] });
  };

  return (
    <div className="space-y-3">
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t("workers.filters.skills_search")}
        leftIcon={<Search />}
        className="h-11"
        lang={locale}
        aria-label={t("workers.filters.skills_search")}
      />
      {visible.length ? (
        <div className="flex flex-wrap gap-2">
          {visible.map((s) => (
            <Chip key={s.id} size="sm" selected={selectedSet.has(s.id)} onClick={() => toggle(s.id)}>
              {name(s)}
            </Chip>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{t("workers.filters.skills_none")}</p>
      )}
    </div>
  );
}

function StatusSection({ draft, patch }: SectionProps) {
  const { t, tEnum } = useT();
  return (
    <div className="space-y-4">
      <div>
        <SectionTitle>{t("workers.filters.status")}</SectionTitle>
        <ChipGroup
          multiple
          size="sm"
          options={WORKER_STATUSES.map((s) => ({ value: s, label: tEnum("worker_status_short", s) }))}
          value={draft.status}
          onChange={(v) => patch({ status: Array.isArray(v) && v.length ? v : [...DEFAULT_STATUSES] })}
        />
      </div>
      <div>
        <SectionTitle>{t("workers.filters.availability")}</SectionTitle>
        <ChipGroup multiple size="sm" options={AVAILABILITIES.map((a) => ({ value: a, label: tEnum("availability", a) }))} value={draft.availability} onChange={(v) => patch({ availability: Array.isArray(v) ? v : [] })} />
      </div>
    </div>
  );
}

function ExtraSection({ draft, patch }: SectionProps) {
  const { t } = useT();
  const remoteValue = draft.remote === true ? "yes" : draft.remote === false ? "no" : null;
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <Checkbox checked={draft.portfolio} onCheckedChange={(c) => patch({ portfolio: c === true })} label={t("workers.filters.portfolio")} />
        <Checkbox checked={draft.verified} onCheckedChange={(c) => patch({ verified: c === true })} label={t("workers.filters.verified")} />
      </div>
      <div>
        <SectionTitle>{t("workers.filters.remote")}</SectionTitle>
        <ChipGroup
          options={[
            { value: "yes", label: t("workers.filters.remote_yes") },
            { value: "no", label: t("workers.filters.remote_no") },
          ]}
          value={remoteValue}
          onChange={(v) => patch({ remote: v === "yes" ? true : v === "no" ? false : null })}
        />
      </div>
    </div>
  );
}

function DistanceSection({ draft, patch, vacancyHasCoords }: SectionProps & { vacancyHasCoords: boolean }) {
  const { t } = useT();
  const { locate, locating } = useGeolocate();
  const hasMe = draft.lat !== null && draft.lng !== null;
  const hasOrigin = hasMe || vacancyHasCoords;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {hasMe ? (
          <Chip selected onClick={() => patch({ lat: null, lng: null, max_km: vacancyHasCoords ? draft.max_km : null, sort: draft.sort === "distance" && !vacancyHasCoords ? "relevant" : draft.sort })} icon={<X />}>
            {t("workers.search.my_location")}
          </Chip>
        ) : (
          <Button
            type="button"
            variant="soft"
            size="sm"
            loading={locating}
            onClick={async () => {
              const pos = await locate();
              if (pos) patch({ lat: pos.lat, lng: pos.lng, max_km: draft.max_km ?? 10, sort: "distance" });
            }}
          >
            {!locating ? <LocateFixed className="size-4" /> : null}
            {locating ? t("workers.search.locating") : t("workers.search.use_location")}
          </Button>
        )}
        {!hasMe && vacancyHasCoords ? <span className="text-xs text-muted-foreground">{t("workers.search.vacancy_location")}</span> : null}
      </div>
      {hasOrigin ? (
        <ChipGroup
          size="sm"
          options={MAX_KM_OPTIONS.map((km) => ({ value: String(km), label: t("workers.filters.max_km", { km }) }))}
          value={draft.max_km ? String(draft.max_km) : null}
          onChange={(v) => patch({ max_km: typeof v === "string" ? Number(v) : null })}
        />
      ) : (
        <p className="text-sm text-muted-foreground">{t("workers.filters.distance_hint")}</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sheet
// ---------------------------------------------------------------------------

const SECTION_RESET: Record<Exclude<SheetKind, "all">, Partial<WorkerSearchParams>> = {
  category: { category: null, subcategory: null, profession: null },
  region: { region: null, district: [] },
  experience: { experience_min: null },
  salary: { salary_max: null },
  schedule: { schedule: [], employment: [] },
};

interface FilterSheetProps {
  kind: SheetKind | null;
  onClose: () => void;
  params: WorkerSearchParams;
  reference: FilterReference;
  vacancyHasCoords: boolean;
  onApply: (draft: WorkerSearchParams) => void;
}

/** Dialog qobig'i: har ochilishda tana (draft holati) qaytadan yaratiladi (key = kind) */
export function FilterSheet(props: FilterSheetProps) {
  const open = props.kind !== null;
  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? props.onClose() : undefined)}>
      {props.kind ? <FilterSheetBody key={props.kind} {...props} kind={props.kind} /> : null}
    </Dialog>
  );
}

function FilterSheetBody({ kind, onClose, params, reference, vacancyHasCoords, onApply }: FilterSheetProps & { kind: SheetKind }) {
  const { t } = useT();
  const [draft, setDraft] = useState<WorkerSearchParams>(params);
  const patch: Patch = (p) => setDraft((d) => ({ ...d, ...p }));
  const props: SectionProps = { draft, patch, reference };

  const titles: Record<SheetKind, string> = {
    category: t("workers.filters.category"),
    region: t("workers.filters.region"),
    experience: t("workers.filters.experience"),
    salary: t("workers.filters.salary_max"),
    schedule: t("workers.filters.schedule"),
    all: t("workers.filters.title"),
  };

  const reset = () => {
    if (kind === "all") {
      setDraft({ ...EMPTY_WORKER_SEARCH, q: draft.q, vacancy: draft.vacancy, lat: draft.lat, lng: draft.lng, sort: draft.sort === "distance" && draft.lat === null && !vacancyHasCoords ? "relevant" : draft.sort });
      return;
    }
    patch(SECTION_RESET[kind]);
  };

  let body: ReactNode = null;
  if (kind === "category") body = <CategorySection {...props} />;
  else if (kind === "region") body = <RegionSection {...props} />;
  else if (kind === "experience") body = <ExperienceSection {...props} />;
  else if (kind === "salary") body = <SalarySection {...props} />;
  else if (kind === "schedule") body = <ScheduleSection {...props} />;
  else if (kind === "all") {
    body = (
      <div className="space-y-6">
        <section>
          <SectionTitle>{t("workers.filters.category")}</SectionTitle>
          <CategorySection {...props} />
        </section>
        <section>
          <SectionTitle>{t("workers.filters.region")}</SectionTitle>
          <RegionSection {...props} />
        </section>
        <section>
          <SectionTitle>{t("workers.filters.experience")}</SectionTitle>
          <ExperienceSection {...props} />
        </section>
        <section>
          <SectionTitle>{t("workers.filters.salary_max")}</SectionTitle>
          <SalarySection {...props} />
        </section>
        <ScheduleSection {...props} />
        <PersonSection {...props} />
        <section>
          <SectionTitle>{t("workers.filters.languages")}</SectionTitle>
          <LanguagesSection {...props} />
        </section>
        <section>
          <SectionTitle>{t("workers.filters.skills")}</SectionTitle>
          <SkillsSection {...props} />
        </section>
        <StatusSection {...props} />
        <section>
          <SectionTitle>{t("workers.filters.extra")}</SectionTitle>
          <ExtraSection {...props} />
        </section>
        <section>
          <SectionTitle>{t("workers.filters.distance")}</SectionTitle>
          <DistanceSection {...props} vacancyHasCoords={vacancyHasCoords} />
        </section>
      </div>
    );
  }

  return (
    <Sheet
      title={titles[kind]}
      className={kind === "all" ? "sm:max-w-2xl" : undefined}
      footer={
        <div className="flex gap-2">
          <Button type="button" variant="secondary" onClick={reset}>
            {t("workers.filters.reset")}
          </Button>
          <Button
            type="button"
            fullWidth
            onClick={() => {
              onApply(draft);
              onClose();
            }}
          >
            {t("workers.filters.show_results")}
          </Button>
        </div>
      }
    >
      <div className="pt-1">{body}</div>
    </Sheet>
  );
}
