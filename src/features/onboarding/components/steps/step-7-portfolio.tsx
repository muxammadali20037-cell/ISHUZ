"use client";

import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Images, Link2, Plus, Sparkles, Trash2 } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { Constants } from "@/types/database.types";
import { Button } from "@/components/ui/button";
import { ChipGroup } from "@/components/ui/chip";
import { Input, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { EmptyState } from "@/components/ui/misc";
import { savePortfolio, skipStep } from "../../actions";
import { portfolioSchema, type PortfolioInput, type PortfolioItemInput } from "../../schema";
import { PORTFOLIO_MAX_FILES, PORTFOLIO_MAX_MB, PORTFOLIO_MIME, type DraftPortfolio } from "../../types";
import { FileUpload } from "../file-upload";
import { WizardFooter, fieldError, singleValue, useStepSubmit } from "../wizard-shell";

const EMPTY_ITEM: PortfolioItemInput = { title: "", description: "", type: "image", media_paths: [], link_url: "" };

export function Step7Portfolio({ userId, items, recommended }: { userId: string; items: DraftPortfolio[]; recommended: boolean }) {
  const { t, tEnum } = useT();
  const { pending, submit } = useStepSubmit();
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<PortfolioInput>({
    resolver: zodResolver(portfolioSchema),
    defaultValues: {
      items: items.map((p) => ({ title: p.title, description: p.description ?? "", type: p.type, media_paths: p.media_paths, link_url: p.link_url ?? "" })),
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  const watchedItems = useWatch({ control, name: "items" });
  const typeOptions = Constants.public.Enums.portfolio_type.map((v) => ({ value: v, label: tEnum("portfolio_type", v) }));

  return (
    <form noValidate onSubmit={handleSubmit((values) => submit(() => savePortfolio(values)))} className="space-y-6">
      {recommended ? (
        <div className="flex items-start gap-3 rounded-2xl border border-warning/40 bg-warning-soft p-4">
          <Sparkles className="mt-0.5 size-5 shrink-0 text-warning" />
          <div>
            <p className="text-sm font-semibold">{t("onboarding.worker.portfolio.recommended_title")}</p>
            <p className="mt-0.5 text-sm text-muted-foreground">{t("onboarding.worker.portfolio.recommended_desc")}</p>
          </div>
        </div>
      ) : null}

      {fields.length === 0 ? (
        <EmptyState
          icon={Images}
          title={t("onboarding.worker.portfolio.empty_title")}
          description={t("onboarding.worker.portfolio.empty_desc")}
          action={{ label: t("onboarding.worker.portfolio.add"), onClick: () => append({ ...EMPTY_ITEM }) }}
        />
      ) : null}

      {fields.map((item, i) => {
        const type = watchedItems[i]?.type ?? "image";
        const itemErrors = errors.items?.[i];
        return (
          <div key={item.id} className="space-y-4 rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">{t("onboarding.worker.portfolio.item_n", { n: i + 1 })}</p>
              <Button type="button" variant="ghost" size="icon-sm" onClick={() => remove(i)} aria-label={t("common.actions.delete")}>
                <Trash2 className="size-4 text-destructive" />
              </Button>
            </div>
            <Field label={t("onboarding.worker.portfolio.item_title")} htmlFor={`pf-title-${i}`} required error={fieldError(t, itemErrors?.title)}>
              <Input id={`pf-title-${i}`} placeholder={t("onboarding.worker.portfolio.item_title_placeholder")} maxLength={120} invalid={!!itemErrors?.title} {...register(`items.${i}.title`)} />
            </Field>
            <Field label={t("onboarding.worker.portfolio.type")} required error={fieldError(t, itemErrors?.type)}>
              <Controller
                control={control}
                name={`items.${i}.type`}
                render={({ field }) => <ChipGroup size="sm" options={typeOptions} value={field.value} onChange={(v) => field.onChange(singleValue(v) ?? field.value)} />}
              />
            </Field>
            {type === "link" ? (
              <Field label={t("onboarding.worker.portfolio.link")} htmlFor={`pf-link-${i}`} required error={fieldError(t, itemErrors?.link_url)}>
                <Input id={`pf-link-${i}`} type="url" inputMode="url" leftIcon={<Link2 />} placeholder="https://" invalid={!!itemErrors?.link_url} {...register(`items.${i}.link_url`)} />
              </Field>
            ) : (
              <Field label={t("onboarding.worker.portfolio.files")} required error={fieldError(t, itemErrors?.media_paths)}>
                <Controller
                  control={control}
                  name={`items.${i}.media_paths`}
                  render={({ field }) => (
                    <FileUpload
                      userId={userId}
                      value={field.value}
                      onChange={field.onChange}
                      accept={PORTFOLIO_MIME[type]}
                      maxFiles={PORTFOLIO_MAX_FILES}
                      maxSizeMb={PORTFOLIO_MAX_MB}
                      invalid={!!itemErrors?.media_paths}
                    />
                  )}
                />
              </Field>
            )}
            <Field label={t("onboarding.worker.portfolio.description")} htmlFor={`pf-desc-${i}`} hint={t("common.labels.optional")} error={fieldError(t, itemErrors?.description)}>
              <Textarea id={`pf-desc-${i}`} className="min-h-[80px]" maxLength={1000} placeholder={t("onboarding.worker.portfolio.description_placeholder")} {...register(`items.${i}.description`)} />
            </Field>
          </div>
        );
      })}

      {fields.length > 0 && fields.length < 20 ? (
        <Button type="button" variant="outline" fullWidth onClick={() => append({ ...EMPTY_ITEM })}>
          <Plus className="size-4" />
          {t("onboarding.worker.portfolio.add")}
        </Button>
      ) : null}

      <WizardFooter step={7} pending={pending} onSkip={() => submit(() => skipStep({ step: 7 }))} />
    </form>
  );
}
