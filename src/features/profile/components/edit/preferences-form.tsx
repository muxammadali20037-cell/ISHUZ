"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n/client";
import { formatMoney } from "@/lib/format";
import type { Benefit } from "@/lib/reference";
import { Button } from "@/components/ui/button";
import { ChipGroup } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Constants, type Enums, type Tables } from "@/types/database.types";
import { updatePreferences } from "../../actions";
import { useAction } from "../use-action";
import { EditSectionCard } from "./section-card";
import { groupDigits, parseMoney } from "./form-utils";

type Prefs = Tables<"worker_preferences">;
const E = Constants.public.Enums;

export function PreferencesForm({ initial, workFormat, officialTerms }: { initial: Prefs | null; workFormat: Enums<"work_format">; officialTerms: Benefit[] }) {
  const { t, tEnum, name, locale } = useT();
  const { pending, run } = useAction();
  const [employment, setEmployment] = useState<Enums<"employment_type">[]>(initial?.employment_types ?? []);
  const [schedules, setSchedules] = useState<Enums<"work_schedule">[]>(initial?.schedules ?? []);
  const [timeFrom, setTimeFrom] = useState(initial?.work_time_from?.slice(0, 5) ?? "");
  const [timeTo, setTimeTo] = useState(initial?.work_time_to?.slice(0, 5) ?? "");
  const [salaryMin, setSalaryMin] = useState<number | null>(initial?.salary_min ?? null);
  const [salaryExpected, setSalaryExpected] = useState<number | null>(initial?.salary_expected ?? null);
  const [salaryType, setSalaryType] = useState<Enums<"salary_type">>(initial?.salary_type ?? "monthly");
  const [availability, setAvailability] = useState<Enums<"availability">>(initial?.availability ?? "negotiable");
  const [format, setFormat] = useState<Enums<"work_format">>(workFormat);
  const [terms, setTerms] = useState<string[]>(initial?.official_terms ?? []);
  const salaryError = salaryMin !== null && salaryExpected !== null && salaryExpected < salaryMin ? t("profile.errors.salary_range") : undefined;

  const save = () =>
    run(() =>
      updatePreferences({
        employment_types: employment,
        schedules,
        work_time_from: timeFrom || null,
        work_time_to: timeTo || null,
        salary_min: salaryMin,
        salary_expected: salaryExpected,
        salary_type: salaryType,
        availability,
        official_terms: format === "unofficial" ? [] : terms,
        work_format: format,
      }),
    );

  const multi = <T extends string>(setter: (v: T[]) => void) => (v: T | T[] | null) => setter(Array.isArray(v) ? v : v ? [v] : []);
  const single = <T extends string>(setter: (v: T) => void) => (v: T | T[] | null) => v && !Array.isArray(v) && setter(v);

  return (
    <EditSectionCard
      id="preferences"
      title={t("profile.sections.preferences")}
      description={t("profile.edit.preferences_hint")}
      footer={
        <Button type="button" loading={pending} disabled={!!salaryError} onClick={save}>
          {t("common.actions.save")}
        </Button>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("profile.labels.salary_expected")} htmlFor="salary_expected" hint={t("profile.labels.sum")} description={salaryExpected !== null ? formatMoney(salaryExpected, locale) : undefined} error={salaryError}>
          <Input id="salary_expected" inputMode="numeric" placeholder="5 000 000" value={groupDigits(salaryExpected)} onChange={(e) => setSalaryExpected(parseMoney(e.target.value))} invalid={!!salaryError} />
        </Field>
        <Field label={t("profile.labels.salary_min")} htmlFor="salary_min" hint={t("profile.labels.sum")} description={salaryMin !== null ? formatMoney(salaryMin, locale) : undefined}>
          <Input id="salary_min" inputMode="numeric" placeholder="4 000 000" value={groupDigits(salaryMin)} onChange={(e) => setSalaryMin(parseMoney(e.target.value))} />
        </Field>
      </div>
      <Field label={t("profile.labels.salary_type")}>
        <ChipGroup size="sm" options={E.salary_type.map((v) => ({ value: v, label: tEnum("salary_type", v) }))} value={salaryType} onChange={single<Enums<"salary_type">>(setSalaryType)} />
      </Field>
      <Field label={t("profile.labels.employment_types")}>
        <ChipGroup multiple size="sm" options={E.employment_type.map((v) => ({ value: v, label: tEnum("employment_type", v) }))} value={employment} onChange={multi<Enums<"employment_type">>(setEmployment)} />
      </Field>
      <Field label={t("profile.labels.schedules")}>
        <ChipGroup multiple size="sm" options={E.work_schedule.map((v) => ({ value: v, label: tEnum("work_schedule", v) }))} value={schedules} onChange={multi<Enums<"work_schedule">>(setSchedules)} />
      </Field>
      <Field label={t("profile.labels.work_hours")} hint={t("profile.labels.optional")}>
        <div className="flex items-center gap-2">
          <Input type="time" aria-label={t("profile.labels.work_time_from")} value={timeFrom} onChange={(e) => setTimeFrom(e.target.value)} className="max-w-[10rem]" />
          <span className="text-sm text-muted-foreground">–</span>
          <Input type="time" aria-label={t("profile.labels.work_time_to")} value={timeTo} onChange={(e) => setTimeTo(e.target.value)} className="max-w-[10rem]" />
        </div>
      </Field>
      <Field label={t("profile.labels.availability")}>
        <ChipGroup size="sm" options={E.availability.map((v) => ({ value: v, label: tEnum("availability", v) }))} value={availability} onChange={single<Enums<"availability">>(setAvailability)} />
      </Field>
      <Field label={t("profile.labels.work_format")}>
        <ChipGroup size="sm" options={E.work_format.map((v) => ({ value: v, label: tEnum("work_format", v) }))} value={format} onChange={single<Enums<"work_format">>(setFormat)} />
      </Field>
      {format !== "unofficial" && officialTerms.length ? (
        <Field label={t("profile.labels.official_terms")} hint={t("profile.labels.optional")}>
          <ChipGroup multiple size="sm" options={officialTerms.map((b) => ({ value: b.code, label: name(b) }))} value={terms} onChange={multi<string>(setTerms)} />
        </Field>
      ) : null}
    </EditSectionCard>
  );
}
