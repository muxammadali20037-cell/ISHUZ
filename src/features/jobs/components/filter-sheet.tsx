"use client";

import { useId } from "react";
import { useT } from "@/lib/i18n/client";
import { formatMoney, formatMoneyShort } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Checkbox, RadioGroup, RadioItem } from "@/components/ui/checkbox";
import { ChipGroup } from "@/components/ui/chip";
import { Dialog, Sheet } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Field, Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  EMPLOYMENT_TYPES,
  EXPERIENCE_MAX_OPTIONS,
  SALARY_MAX,
  SALARY_PRESETS,
  SCHEDULES,
  type EmploymentType,
  type FormatKey,
  type JobsSearchParams,
  type WorkSchedule,
} from "../search-params";
import type { JobsFilterRefs } from "../types";

export type SheetKind = "all" | "region" | "salary" | "schedule" | "experience";

type Patch = (patch: Partial<JobsSearchParams>) => void;
interface SectionProps {
  draft: JobsSearchParams;
  patch: Patch;
  refs: JobsFilterRefs;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-2 text-sm font-semibold text-foreground">{children}</h3>;
}

function CategorySection({ draft, patch, refs }: SectionProps) {
  const { t, name } = useT();
  const category = refs.categories.find((c) => c.slug === draft.category) ?? null;
  const subs = category ? refs.subcategories.filter((s) => s.category_id === category.id) : [];
  const catId = useId();
  const subId = useId();
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label={t("jobs.filters.category")} htmlFor={catId}>
        <Select
          id={catId}
          value={draft.category ?? ""}
          placeholder={t("jobs.filters.all_categories")}
          options={refs.categories.map((c) => ({
            value: c.slug,
            label: name(c),
          }))}
          onChange={(e) => patch({ category: e.target.value || null, subcategory: null })}
        />
      </Field>
      <Field label={t("jobs.filters.subcategory")} htmlFor={subId}>
        <Select
          id={subId}
          value={draft.subcategory ?? ""}
          placeholder={t("jobs.filters.all_subcategories")}
          disabled={!category}
          options={subs.map((s) => ({ value: s.slug, label: name(s) }))}
          onChange={(e) => patch({ subcategory: e.target.value || null })}
        />
      </Field>
    </div>
  );
}

function RegionSection({ draft, patch, refs }: SectionProps) {
  const { t, name } = useT();
  const region = refs.regions.find((r) => r.slug === draft.region) ?? null;
  const districts = region ? refs.districts.filter((d) => d.region_id === region.id) : [];
  const id = useId();
  return (
    <div className="space-y-3">
      <Field label={t("jobs.filters.region")} htmlFor={id}>
        <Select
          id={id}
          value={draft.region ?? ""}
          placeholder={t("jobs.filters.all_regions")}
          options={refs.regions.map((r) => ({ value: r.slug, label: name(r) }))}
          onChange={(e) => patch({ region: e.target.value || null, district: [] })}
        />
      </Field>
      {districts.length ? (
        <div>
          <Label hint={t("jobs.filters.districts_hint")}>{t("jobs.filters.districts")}</Label>
          <ChipGroup
            multiple
            size="sm"
            options={districts.map((d) => ({ value: d.id, label: name(d) }))}
            value={draft.district}
            onChange={(next) =>
              patch({
                district: Array.isArray(next) ? next : next ? [next] : [],
              })
            }
          />
        </div>
      ) : null}
    </div>
  );
}

function SalarySection({ draft, patch }: SectionProps) {
  const { t, locale } = useT();
  const id = useId();
  return (
    <div className="space-y-3">
      <ChipGroup
        size="sm"
        options={SALARY_PRESETS.map((p) => ({
          value: String(p),
          label: `${formatMoneyShort(p, locale)}+`,
        }))}
        value={draft.salaryMin ? String(draft.salaryMin) : null}
        onChange={(next) => patch({ salaryMin: typeof next === "string" ? Number(next) : null })}
      />
      <Field label={t("jobs.filters.salary_min")} htmlFor={id} hint={t("jobs.filters.salary_min_hint")}>
        <Input
          id={id}
          inputMode="numeric"
          autoComplete="off"
          placeholder={t("jobs.filters.salary_placeholder")}
          value={draft.salaryMin ? formatMoney(draft.salaryMin, locale, { withCurrency: false }) : ""}
          onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
            const n = digits ? Math.min(Number(digits), SALARY_MAX) : 0;
            patch({ salaryMin: n > 0 ? n : null });
          }}
        />
      </Field>
    </div>
  );
}

function ScheduleSection({ draft, patch }: SectionProps) {
  const { tEnum } = useT();
  return (
    <ChipGroup
      multiple
      size="sm"
      options={SCHEDULES.map((s) => ({
        value: s,
        label: tEnum("work_schedule", s),
      }))}
      value={draft.schedule}
      onChange={(next) =>
        patch({
          schedule: (Array.isArray(next) ? next : next ? [next] : []) as WorkSchedule[],
        })
      }
    />
  );
}

function EmploymentSection({ draft, patch }: SectionProps) {
  const { tEnum } = useT();
  return (
    <ChipGroup
      multiple
      size="sm"
      options={EMPLOYMENT_TYPES.map((s) => ({
        value: s,
        label: tEnum("employment_type", s),
      }))}
      value={draft.employment}
      onChange={(next) =>
        patch({
          employment: (Array.isArray(next) ? next : next ? [next] : []) as EmploymentType[],
        })
      }
    />
  );
}

function ExperienceSection({ draft, patch }: SectionProps) {
  const { t } = useT();
  const value = draft.noExperience ? "0" : draft.experienceMax !== null ? String(draft.experienceMax) : "any";
  return (
    <RadioGroup
      value={value}
      onValueChange={(v) => {
        if (v === "any") patch({ experienceMax: null, noExperience: false });
        else if (v === "0") patch({ experienceMax: null, noExperience: true });
        else patch({ experienceMax: Number(v), noExperience: false });
      }}
      className="space-y-2"
    >
      <RadioItem value="any" label={t("jobs.filters.any")} />
      {EXPERIENCE_MAX_OPTIONS.map((m) => (
        <RadioItem key={m} value={String(m)} label={t(`jobs.filters.experience_options.${m}`)} />
      ))}
    </RadioGroup>
  );
}

function FormatSection({ draft, patch }: SectionProps) {
  const { t, tEnum } = useT();
  const options: { value: FormatKey | "any"; label: string }[] = [
    { value: "any", label: t("jobs.filters.any") },
    { value: "official", label: tEnum("work_format", "official") },
    { value: "unofficial", label: tEnum("work_format", "unofficial") },
  ];
  return (
    <ChipGroup
      size="sm"
      options={options}
      value={draft.format ?? "any"}
      onChange={(next) =>
        patch({
          format: next === "official" || next === "unofficial" ? next : null,
        })
      }
    />
  );
}

function TogglesSection({ draft, patch, refs }: SectionProps) {
  const { t, name } = useT();
  return (
    <div className="space-y-1">
      <Checkbox
        checked={draft.remote}
        onCheckedChange={(c) => patch({ remote: c === true })}
        label={t("jobs.filters.remote")}
        description={t("jobs.filters.remote_hint")}
      />
      <Checkbox checked={draft.verified} onCheckedChange={(c) => patch({ verified: c === true })} label={t("jobs.filters.verified")} />
      {refs.benefits.length ? (
        <div className="pt-3">
          <SectionTitle>{t("jobs.filters.benefits")}</SectionTitle>
          <div className="grid sm:grid-cols-2">
            {refs.benefits.map((b) => (
              <Checkbox
                key={b.code}
                checked={draft.benefits.includes(b.code)}
                onCheckedChange={(c) =>
                  patch({
                    benefits: c === true ? [...draft.benefits, b.code] : draft.benefits.filter((x) => x !== b.code),
                  })
                }
                label={name(b)}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Filtr sheet'i (mobil: pastdan; desktop: modal). `kind` qaysi bo'limlarni ko'rsatishni belgilaydi.
 * O'zgarishlar `draft` da to'planadi; "Natijalarni ko'rsatish" → onApply.
 */
export function FilterSheet({
  kind,
  open,
  onOpenChange,
  draft,
  patch,
  refs,
  onApply,
  onReset,
  pending,
}: {
  kind: SheetKind;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft: JobsSearchParams;
  patch: Patch;
  refs: JobsFilterRefs;
  onApply: () => void;
  onReset: () => void;
  pending?: boolean;
}) {
  const { t } = useT();
  const props = { draft, patch, refs };
  const titles: Record<SheetKind, string> = {
    all: t("jobs.filters.all"),
    region: t("jobs.filters.region"),
    salary: t("jobs.filters.salary"),
    schedule: t("jobs.filters.schedule"),
    experience: t("jobs.filters.experience"),
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <Sheet
        title={titles[kind]}
        footer={
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={onReset} className="shrink-0">
              {t("jobs.filters.reset")}
            </Button>
            <Button type="button" onClick={onApply} loading={pending} className="flex-1">
              {t("common.actions.show_results")}
            </Button>
          </div>
        }
      >
        {kind === "region" ? <RegionSection {...props} /> : null}
        {kind === "salary" ? <SalarySection {...props} /> : null}
        {kind === "schedule" ? (
          <div className="space-y-5">
            <section>
              <SectionTitle>{t("jobs.filters.schedule")}</SectionTitle>
              <ScheduleSection {...props} />
            </section>
            <section>
              <SectionTitle>{t("jobs.filters.employment")}</SectionTitle>
              <EmploymentSection {...props} />
            </section>
          </div>
        ) : null}
        {kind === "experience" ? <ExperienceSection {...props} /> : null}
        {kind === "all" ? (
          <div className="space-y-6">
            <section>
              <CategorySection {...props} />
            </section>
            <section>
              <RegionSection {...props} />
            </section>
            <section>
              <SectionTitle>{t("jobs.filters.salary")}</SectionTitle>
              <SalarySection {...props} />
            </section>
            <section>
              <SectionTitle>{t("jobs.filters.schedule")}</SectionTitle>
              <ScheduleSection {...props} />
            </section>
            <section>
              <SectionTitle>{t("jobs.filters.employment")}</SectionTitle>
              <EmploymentSection {...props} />
            </section>
            <section>
              <SectionTitle>{t("jobs.filters.experience_max")}</SectionTitle>
              <ExperienceSection {...props} />
            </section>
            <section>
              <SectionTitle>{t("jobs.filters.format")}</SectionTitle>
              <FormatSection {...props} />
            </section>
            <section>
              <TogglesSection {...props} />
            </section>
          </div>
        ) : null}
      </Sheet>
    </Dialog>
  );
}
