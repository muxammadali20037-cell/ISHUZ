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
import { personSchema, type PersonFormInput, type PersonFormValues } from "../schema";
import { SelectField } from "./select-field";
import { ChoiceList, LocateAsk } from "@/components/shared/locate-ask";
import { TelegramPhoneShare } from "@/features/contacts/telegram-phone-share";
import { formatPhone } from "@/lib/format";
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
  stepByStep,
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
  /** Har ekranda bitta savol (onboarding). Sozlamalarda — oddiy forma */
  stepByStep?: boolean;
}) {
  const { t, name } = useT();
  const form = useForm<PersonFormInput, unknown, PersonFormValues>({
    resolver: zodResolver(personSchema),
    defaultValues: { ...EMPTY_PERSON_FORM, ...defaultValues },
    mode: "onBlur",
  });
  const { register, control, handleSubmit, setValue, getValues, trigger, formState } = form;
  const errors = formState.errors;
  const regionId = useWatch({ control, name: "regionId" });
  const districtId = useWatch({ control, name: "districtId" });
  const regionOptions = useMemo(() => refs.regions.map((r) => ({ value: r.id, label: name(r) })), [refs.regions, name]);
  const districtOptions = useMemo(() => refs.districts.filter((d) => d.region_id === regionId).map((d) => ({ value: d.id, label: name(d) })), [refs.districts, regionId, name]);
  const flow = useQuestionFlow<PersonFormInput>(
    // Onboarding: joylashuv → viloyat → tuman → ism → telefon (kompaniya nomi so'ralmaydi)
    stepByStep
      ? [
          { id: "locate" },
          { id: "region", fields: ["regionId"] },
          { id: "district", fields: ["districtId"] },
          { id: "name", fields: ["displayName"] },
          { id: "phone", fields: ["contactPhone"] },
        ]
      : [
          { id: "name", fields: ["displayName"] },
          { id: "phone", fields: ["contactPhone"] },
          { id: "region", fields: ["regionId"] },
          { id: "district", fields: ["districtId"] },
          { id: "about", fields: ["about"] },
        ],
    trigger,
  );
  const q = (id: string, node: ReactNode) => (!stepByStep || flow.is(id) ? node : null);
  const sz = stepByStep ? "lg" : undefined;
  const advance = stepByStep ? flow.advance : undefined;
  const err = (key: keyof PersonFormInput) => {
    const m = errors[key]?.message;
    return m ? t(m) : undefined;
  };

  return (
    <form onSubmit={stepByStep ? flow.bindSubmit(handleSubmit((v) => void onSubmit(v), flow.onInvalid)) : handleSubmit((v) => void onSubmit(v))} className={className} noValidate>
      {stepByStep ? <QuestionProgress flow={flow} className="mb-5" /> : null}
      <fieldset disabled={pending} className={cn("space-y-5", stepByStep && "animate-fade-in")} key={stepByStep ? flow.index : undefined}>
        {stepByStep && flow.is("locate") ? (
          <LocateAsk
            districts={refs.districts}
            title={t("employer.onboarding.where_person_title")}
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
        {q(
          "name",
          <Field size={sz} label={t("employer.form.display_name")} htmlFor="person-name" required description={t("employer.form.display_name_hint")} error={err("displayName")}>
            <Input
              id="person-name"
              placeholder={t("employer.form.display_name_placeholder")}
              maxLength={80}
              invalid={!!errors.displayName}
              autoFocus={stepByStep}
              autoComplete="name"
              {...register("displayName")}
            />
          </Field>,
        )}
        {q(
          "phone",
          <Field size={sz} label={t("employer.form.contact_phone")} htmlFor="person-phone" description={t("employer.form.contact_phone_hint")} error={err("contactPhone")}>
            <Input id="person-phone" type="tel" inputMode="tel" autoComplete="tel" placeholder={t("employer.form.phone_placeholder")} invalid={!!errors.contactPhone} {...register("contactPhone")} />
            {stepByStep ? <TelegramPhoneShare className="mt-3" onShared={(p) => setValue("contactPhone", formatPhone(p), { shouldValidate: true })} /> : null}
          </Field>,
        )}
        <div className={cn(!stepByStep && "grid gap-4 sm:grid-cols-2")}>
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
          "about",
          <Field size={sz} label={t("employer.form.person_about")} htmlFor="person-about" error={err("about")}>
            <Textarea id="person-about" placeholder={t("employer.form.person_about_placeholder")} maxLength={2000} invalid={!!errors.about} {...register("about")} />
          </Field>,
        )}
      </fieldset>
      <div className={cn("mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end")}>
        {stepByStep && !flow.isFirst ? (
          <Button type="button" variant="ghost" size="lg" disabled={pending} onClick={flow.back}>
            <ChevronLeft className="size-5" /> {t("common.actions.back")}
          </Button>
        ) : onBack ? (
          <Button type="button" variant="ghost" size="lg" disabled={pending} onClick={() => onBack(getValues())}>
            <ChevronLeft className="size-5" /> {backLabel}
          </Button>
        ) : null}
        <Button type="submit" size="lg" loading={pending} className={cn("sm:min-w-48", stepByStep && flow.is("locate") && "hidden")}>
          {stepByStep && !flow.isLast ? t("common.actions.next") : submitLabel}
        </Button>
      </div>
    </form>
  );
}
