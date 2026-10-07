"use client";

import { useMemo, type ReactNode } from "react";
import { ChevronLeft } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useT } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { QuestionProgress, useQuestionFlow } from "@/components/shared/question-flow";
import { cn } from "@/lib/utils";
import { companyOnboardingSchema, companySchema, COMPANY_SIZES, type CompanyFormInput, type CompanyFormValues } from "../schema";
import { SelectField } from "./select-field";
import { ChoiceList, LocateAsk } from "@/components/shared/locate-ask";
import { TelegramPhoneShare } from "@/features/contacts/telegram-phone-share";
import { formatPhone } from "@/lib/format";
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
  stepByStep,
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
  /** Har ekranda bitta savol (onboarding). topSlot oxirgi savol bo'ladi */
  stepByStep?: boolean;
}) {
  const { t, tEnum, name } = useT();
  const form = useForm<CompanyFormInput, unknown, CompanyFormValues>({
    resolver: zodResolver(stepByStep ? companyOnboardingSchema : companySchema),
    defaultValues: { ...EMPTY_COMPANY_FORM, ...defaultValues },
    mode: "onBlur",
  });
  const { register, control, handleSubmit, setValue, trigger, formState } = form;
  const errors = formState.errors;
  const regionId = useWatch({ control, name: "regionId" });
  const districtId = useWatch({ control, name: "districtId" });

  const regionOptions = useMemo(() => refs.regions.map((r) => ({ value: r.id, label: name(r) })), [refs.regions, name]);
  const districtOptions = useMemo(() => refs.districts.filter((d) => d.region_id === regionId).map((d) => ({ value: d.id, label: name(d) })), [refs.districts, regionId, name]);
  const categoryOptions = useMemo(() => refs.categories.map((c) => ({ value: c.id, label: name(c) })), [refs.categories, name]);
  const sizeOptions = useMemo(() => COMPANY_SIZES.map((s) => ({ value: s, label: tEnum("company_size", s) })), [tEnum]);
  // Onboarding (stepByStep): faqat eng kerakli savollar — joylashuv → viloyat → tuman → nom → telefon.
  // Qolganlari (sayt, soha, hajm, STIR, logo) keyin kompaniya sozlamalarida.
  const flow = useQuestionFlow<CompanyFormInput>(
    stepByStep
      ? [
          { id: "locate" },
          { id: "region", fields: ["regionId"] },
          { id: "district", fields: ["districtId"] },
          { id: "name", fields: ["name"] },
          { id: "phone", fields: ["phone", "telegram"] },
        ]
      : [
          { id: "name", fields: ["name"] },
          { id: "phone", fields: ["phone", "telegram"] },
          { id: "links", fields: ["website", "instagram"] },
          { id: "region", fields: ["regionId"] },
          { id: "district", fields: ["districtId"] },
          { id: "address", fields: ["address"] },
          { id: "industry", fields: ["industryCategoryId"] },
          { id: "size", fields: ["size", "tin"] },
          { id: "about", fields: ["about"] },
          { id: "logo", hidden: !topSlot },
        ],
    trigger,
  );
  const q = (id: string, node: ReactNode) => (!stepByStep || flow.is(id) ? node : null);
  const sz = stepByStep ? "lg" : undefined;
  const advance = stepByStep ? flow.advance : undefined;
  const grid = cn(stepByStep ? "space-y-5" : "grid gap-4 sm:grid-cols-2");
  const err = (key: keyof CompanyFormInput) => {
    const m = errors[key]?.message;
    return m ? t(m) : undefined;
  };
  const disabled = readOnly || pending;

  return (
    <form onSubmit={stepByStep ? flow.bindSubmit(handleSubmit((v) => void onSubmit(v), flow.onInvalid)) : handleSubmit((v) => void onSubmit(v))} className={className} noValidate>
      {stepByStep ? <QuestionProgress flow={flow} className="mb-5" /> : null}
      <fieldset disabled={disabled} className={cn("space-y-5", stepByStep && "animate-fade-in")} key={stepByStep ? flow.index : undefined}>
        {stepByStep ? null : topSlot}
        {stepByStep && flow.is("locate") ? (
          <LocateAsk
            districts={refs.districts}
            title={t("employer.onboarding.where_title")}
            subtitle={t("employer.onboarding.where_sub")}
            onLocated={(d) => {
              setValue("regionId", d.region_id, { shouldValidate: true });
              setValue("districtId", d.id, { shouldValidate: true });
              flow.advance();
            }}
            onManual={() => void flow.next()}
          />
        ) : null}
        {stepByStep && flow.is("region") ? (
          <ChoiceList
            title={t("employer.form.region")}
            subtitle={regionId ? t("common.locate.confirm_hint") : undefined}
            options={regionOptions}
            value={regionId}
            columns={2}
            onPick={(v) => {
              if (v !== regionId) setValue("districtId", "");
              setValue("regionId", v, { shouldValidate: true });
              flow.advance();
            }}
          />
        ) : null}
        {stepByStep && flow.is("district") ? (
          <ChoiceList
            title={t("employer.form.district")}
            options={districtOptions}
            value={districtId}
            columns={2}
            onPick={(v) => {
              setValue("districtId", v, { shouldValidate: true });
              flow.advance();
            }}
          />
        ) : null}
        {err("regionId") && stepByStep && flow.is("region") ? <p className="text-sm text-destructive">{err("regionId")}</p> : null}
        {q(
          "name",
          <Field size={sz} label={t("employer.form.company_name")} htmlFor="company-name" required error={err("name")}>
            <Input
              id="company-name"
              placeholder={t("employer.form.company_name_placeholder")}
              maxLength={120}
              invalid={!!errors.name}
              autoFocus={stepByStep}
              autoComplete="organization"
              {...register("name")}
            />
          </Field>,
        )}

        <div className={grid}>
          {q(
            "phone",
            <Field size={sz} label={t("employer.form.phone")} htmlFor="company-phone" required={stepByStep} error={err("phone")} description={stepByStep ? t("contacts.share.employer_hint") : undefined}>
              <Input id="company-phone" type="tel" inputMode="tel" autoComplete="tel" placeholder={t("employer.form.phone_placeholder")} invalid={!!errors.phone} {...register("phone")} />
              {stepByStep ? <TelegramPhoneShare className="mt-3" onShared={(p) => setValue("phone", formatPhone(p), { shouldValidate: true })} /> : null}
            </Field>,
          )}
          {q(
            "phone",
            <Field label={t("employer.form.telegram")} htmlFor="company-telegram" error={err("telegram")}>
              <Input id="company-telegram" placeholder={t("employer.form.telegram_placeholder")} invalid={!!errors.telegram} autoCapitalize="none" {...register("telegram")} />
            </Field>,
          )}
          {q(
            "links",
            <Field label={t("employer.form.website")} htmlFor="company-website" error={err("website")}>
              <Input id="company-website" type="url" inputMode="url" placeholder={t("employer.form.website_placeholder")} invalid={!!errors.website} autoCapitalize="none" {...register("website")} />
            </Field>,
          )}
          {q(
            "links",
            <Field label={t("employer.form.instagram")} htmlFor="company-instagram" hint={t("common.labels.optional")} error={err("instagram")}>
              <Input id="company-instagram" placeholder={t("employer.form.instagram_placeholder")} invalid={!!errors.instagram} autoCapitalize="none" {...register("instagram")} />
            </Field>,
          )}
        </div>

        <div className={grid}>
          {stepByStep ? null : q(
            "region",
            <SelectField
              size={sz}
              control={control}
              name="regionId"
              label={t("employer.form.region")}
              options={regionOptions}
              placeholder={t("common.actions.choose")}
              error={err("regionId")}
              onValueChange={(v) => {
                setValue("districtId", "");
                if (v) advance?.();
              }}
            />,
          )}
          {stepByStep ? null : q(
            "district",
            <SelectField
              size={sz}
              onValueChange={(v) => {
                if (v) advance?.();
              }}
              control={control}
              name="districtId"
              label={t("employer.form.district")}
              options={districtOptions}
              placeholder={regionId ? t("common.actions.choose") : t("employer.form.select_region_first")}
              disabled={!regionId}
              error={err("districtId")}
            />,
          )}
        </div>
        {q(
          "address",
          <Field size={sz} label={t("employer.form.address")} htmlFor="company-address" error={err("address")}>
            <Input id="company-address" placeholder={t("employer.form.address_placeholder")} maxLength={200} invalid={!!errors.address} autoComplete="street-address" {...register("address")} />
          </Field>,
        )}

        {q(
          "industry",
          <SelectField
            size={sz}
            control={control}
            name="industryCategoryId"
            label={t("employer.form.industry")}
            options={categoryOptions}
            placeholder={t("common.actions.choose")}
            error={err("industryCategoryId")}
            onValueChange={(v) => {
              if (v) advance?.();
            }}
          />,
        )}

        {q(
          "about",
          <Field size={sz} label={t("employer.form.about")} htmlFor="company-about" error={err("about")}>
            <Textarea id="company-about" placeholder={t("employer.form.about_placeholder")} maxLength={2000} invalid={!!errors.about} {...register("about")} />
          </Field>,
        )}

        <div className={grid}>
          {q("size", <SelectField size={sz} control={control} name="size" label={t("employer.form.size")} options={sizeOptions} placeholder={t("common.actions.choose")} error={err("size")} />)}
          {q(
            "size",
            <Field label={t("employer.form.tin")} htmlFor="company-tin" hint={t("employer.form.tin_hint")} error={err("tin")}>
              <Input id="company-tin" inputMode="numeric" placeholder={t("employer.form.tin_placeholder")} maxLength={9} invalid={!!errors.tin} {...register("tin")} />
            </Field>,
          )}
        </div>
        {stepByStep ? q("logo", topSlot) : null}
      </fieldset>

      {!readOnly ? (
        <div className={cn("mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end")}>
          {stepByStep && !flow.isFirst ? (
            <Button type="button" variant="ghost" size="lg" disabled={pending} onClick={flow.back}>
              <ChevronLeft className="size-5" /> {t("common.actions.back")}
            </Button>
          ) : (
            secondaryAction
          )}
          <Button type="submit" size="lg" loading={pending} className={cn("sm:min-w-48", stepByStep && flow.is("locate") && "hidden")}>
            {stepByStep && !flow.isLast ? t("common.actions.next") : submitLabel}
          </Button>
        </div>
      ) : null}
    </form>
  );
}
