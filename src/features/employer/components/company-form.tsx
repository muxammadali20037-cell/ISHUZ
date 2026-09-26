"use client";

import { useMemo, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useT } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { companySchema, COMPANY_SIZES, type CompanyFormInput, type CompanyFormValues } from "../schema";
import { SelectField } from "./select-field";
import type { ReferenceLists } from "./ref-types";

export const EMPTY_COMPANY_FORM: CompanyFormInput = {
  name: "",
  phone: "",
  telegram: "",
  website: "",
  instagram: "",
  address: "",
  regionId: "",
  districtId: "",
  industryCategoryId: "",
  about: "",
  size: "",
  tin: "",
};

/**
 * Kompaniya formasi (onboarding, sozlamalar, "Kompaniya yaratish" uchun umumiy).
 * Validatsiya: companySchema (zod) — xato matnlari i18n kalitlari.
 */
export function CompanyForm({
  defaultValues,
  refs,
  onSubmit,
  submitLabel,
  pending,
  readOnly,
  topSlot,
  secondaryAction,
  className,
}: {
  defaultValues?: Partial<CompanyFormInput>;
  refs: ReferenceLists;
  onSubmit: (values: CompanyFormValues) => void | Promise<void>;
  submitLabel: string;
  pending?: boolean;
  readOnly?: boolean;
  topSlot?: ReactNode;
  secondaryAction?: ReactNode;
  className?: string;
}) {
  const { t, tEnum, name } = useT();
  const form = useForm<CompanyFormInput, unknown, CompanyFormValues>({
    resolver: zodResolver(companySchema),
    defaultValues: { ...EMPTY_COMPANY_FORM, ...defaultValues },
    mode: "onBlur",
  });
  const { register, control, handleSubmit, watch, setValue, formState } = form;
  const errors = formState.errors;
  const regionId = watch("regionId");

  const regionOptions = useMemo(() => refs.regions.map((r) => ({ value: r.id, label: name(r) })), [refs.regions, name]);
  const districtOptions = useMemo(() => refs.districts.filter((d) => d.region_id === regionId).map((d) => ({ value: d.id, label: name(d) })), [refs.districts, regionId, name]);
  const categoryOptions = useMemo(() => refs.categories.map((c) => ({ value: c.id, label: name(c) })), [refs.categories, name]);
  const sizeOptions = useMemo(() => COMPANY_SIZES.map((s) => ({ value: s, label: tEnum("company_size", s) })), [tEnum]);
  const err = (key: keyof CompanyFormInput) => {
    const m = errors[key]?.message;
    return m ? t(m) : undefined;
  };
  const disabled = readOnly || pending;

  return (
    <form onSubmit={handleSubmit((v) => void onSubmit(v))} className={className} noValidate>
      <fieldset disabled={disabled} className="space-y-5">
        {topSlot}
        <Field label={t("employer.form.company_name")} htmlFor="company-name" required error={err("name")}>
          <Input id="company-name" placeholder={t("employer.form.company_name_placeholder")} maxLength={120} invalid={!!errors.name} autoComplete="organization" {...register("name")} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("employer.form.phone")} htmlFor="company-phone" error={err("phone")}>
            <Input id="company-phone" type="tel" inputMode="tel" autoComplete="tel" placeholder={t("employer.form.phone_placeholder")} invalid={!!errors.phone} {...register("phone")} />
          </Field>
          <Field label={t("employer.form.telegram")} htmlFor="company-telegram" error={err("telegram")}>
            <Input id="company-telegram" placeholder={t("employer.form.telegram_placeholder")} invalid={!!errors.telegram} autoCapitalize="none" {...register("telegram")} />
          </Field>
          <Field label={t("employer.form.website")} htmlFor="company-website" error={err("website")}>
            <Input id="company-website" type="url" inputMode="url" placeholder={t("employer.form.website_placeholder")} invalid={!!errors.website} autoCapitalize="none" {...register("website")} />
          </Field>
          <Field label={t("employer.form.instagram")} htmlFor="company-instagram" hint={t("common.labels.optional")} error={err("instagram")}>
            <Input id="company-instagram" placeholder={t("employer.form.instagram_placeholder")} invalid={!!errors.instagram} autoCapitalize="none" {...register("instagram")} />
          </Field>
        </div>

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
        <Field label={t("employer.form.address")} htmlFor="company-address" error={err("address")}>
          <Input id="company-address" placeholder={t("employer.form.address_placeholder")} maxLength={200} invalid={!!errors.address} autoComplete="street-address" {...register("address")} />
        </Field>

        <SelectField control={control} name="industryCategoryId" label={t("employer.form.industry")} options={categoryOptions} placeholder={t("common.actions.choose")} error={err("industryCategoryId")} />

        <Field label={t("employer.form.about")} htmlFor="company-about" error={err("about")}>
          <Textarea id="company-about" placeholder={t("employer.form.about_placeholder")} maxLength={2000} invalid={!!errors.about} {...register("about")} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField control={control} name="size" label={t("employer.form.size")} options={sizeOptions} placeholder={t("common.actions.choose")} error={err("size")} />
          <Field label={t("employer.form.tin")} htmlFor="company-tin" hint={t("employer.form.tin_hint")} error={err("tin")}>
            <Input id="company-tin" inputMode="numeric" placeholder={t("employer.form.tin_placeholder")} maxLength={9} invalid={!!errors.tin} {...register("tin")} />
          </Field>
        </div>
      </fieldset>

      {!readOnly ? (
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          {secondaryAction}
          <Button type="submit" size="lg" loading={pending} className="sm:min-w-48">
            {submitLabel}
          </Button>
        </div>
      ) : null}
    </form>
  );
}
