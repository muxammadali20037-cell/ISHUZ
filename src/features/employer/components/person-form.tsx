"use client";

import { useMemo } from "react";
import { ChevronLeft } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useT } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { personSchema, type PersonFormInput, type PersonFormValues } from "../schema";
import { SelectField } from "./select-field";
import type { ReferenceLists } from "./ref-types";

export const EMPTY_PERSON_FORM: PersonFormInput = { displayName: "", contactPhone: "", regionId: "", districtId: "", about: "" };

/** Oddiy shaxs / kompaniyasiz YaTT profili formasi (onboarding va sozlamalar) */
export function PersonForm({
  defaultValues,
  refs,
  onSubmit,
  submitLabel,
  pending,
  onBack,
  backLabel,
  className,
}: {
  defaultValues?: Partial<PersonFormInput>;
  refs: Pick<ReferenceLists, "regions" | "districts">;
  onSubmit: (values: PersonFormValues) => void | Promise<void>;
  submitLabel: string;
  pending?: boolean;
  /** "Orqaga": joriy (tekshirilmagan) qiymatlar qoralama sifatida beriladi */
  onBack?: (draft: PersonFormInput) => void;
  backLabel?: string;
  className?: string;
}) {
  const { t, name } = useT();
  const form = useForm<PersonFormInput, unknown, PersonFormValues>({
    resolver: zodResolver(personSchema),
    defaultValues: { ...EMPTY_PERSON_FORM, ...defaultValues },
    mode: "onBlur",
  });
  const { register, control, handleSubmit, setValue, getValues, formState } = form;
  const errors = formState.errors;
  const regionId = useWatch({ control, name: "regionId" });
  const regionOptions = useMemo(() => refs.regions.map((r) => ({ value: r.id, label: name(r) })), [refs.regions, name]);
  const districtOptions = useMemo(() => refs.districts.filter((d) => d.region_id === regionId).map((d) => ({ value: d.id, label: name(d) })), [refs.districts, regionId, name]);
  const err = (key: keyof PersonFormInput) => {
    const m = errors[key]?.message;
    return m ? t(m) : undefined;
  };

  return (
    <form onSubmit={handleSubmit((v) => void onSubmit(v))} className={className} noValidate>
      <fieldset disabled={pending} className="space-y-5">
        <Field label={t("employer.form.display_name")} htmlFor="person-name" required description={t("employer.form.display_name_hint")} error={err("displayName")}>
          <Input id="person-name" placeholder={t("employer.form.display_name_placeholder")} maxLength={80} invalid={!!errors.displayName} autoComplete="name" {...register("displayName")} />
        </Field>
        <Field label={t("employer.form.contact_phone")} htmlFor="person-phone" description={t("employer.form.contact_phone_hint")} error={err("contactPhone")}>
          <Input id="person-phone" type="tel" inputMode="tel" autoComplete="tel" placeholder={t("employer.form.phone_placeholder")} invalid={!!errors.contactPhone} {...register("contactPhone")} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField control={control} name="regionId" label={t("employer.form.region")} options={regionOptions} placeholder={t("common.actions.choose")} error={err("regionId")} onValueChange={() => setValue("districtId", "")} />
          <SelectField
            control={control}
            name="districtId"
            label={t("employer.form.district")}
            options={districtOptions}
            placeholder={regionId ? t("common.actions.choose") : t("employer.form.select_region_first")}
            disabled={!regionId}
            error={err("districtId")}
          />
        </div>
        <Field label={t("employer.form.person_about")} htmlFor="person-about" error={err("about")}>
          <Textarea id="person-about" placeholder={t("employer.form.person_about_placeholder")} maxLength={2000} invalid={!!errors.about} {...register("about")} />
        </Field>
      </fieldset>
      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {onBack ? (
          <Button type="button" variant="ghost" size="lg" disabled={pending} onClick={() => onBack(getValues())}>
            <ChevronLeft className="size-5" /> {backLabel}
          </Button>
        ) : null}
        <Button type="submit" size="lg" loading={pending} className="sm:min-w-48">
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
