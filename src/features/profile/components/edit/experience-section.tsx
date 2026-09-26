"use client";

import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Building2, Pencil, Plus, Trash2 } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDialog, Dialog, Sheet } from "@/components/ui/dialog";
import { Input, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { deleteExperience, saveExperience } from "../../actions";
import { formatExperienceRange, isoDateToMonth, monthToIsoDate } from "../../pure";
import type { WorkerExperienceRow } from "../../queries";
import { useAction } from "../use-action";
import { MonthYearPicker, type MonthYear } from "./month-year-picker";
import { EditSectionCard } from "./section-card";
import { fieldError } from "./form-utils";

const monthYear = z.object({ year: z.number().nullable(), month: z.number().nullable() });
const formSchema = z
  .object({
    company_name: z.string().trim().min(2, "min_length").max(120, "max_length"),
    position: z.string().trim().min(2, "min_length").max(120, "max_length"),
    started: monthYear.refine((v) => !!monthToIsoDate(v.year, v.month), "required"),
    ended: monthYear,
    is_current: z.boolean(),
    responsibilities: z.string().trim().max(2000, "max_length"),
    achievements: z.string().trim().max(2000, "max_length"),
  })
  .refine((d) => d.is_current || !!monthToIsoDate(d.ended.year, d.ended.month), { message: "required", path: ["ended"] })
  .refine(
    (d) => {
      if (d.is_current) return true;
      const s = monthToIsoDate(d.started.year, d.started.month);
      const e = monthToIsoDate(d.ended.year, d.ended.month);
      return !s || !e || e >= s;
    },
    { message: "invalid_dates", path: ["ended"] },
  );
type FormValues = z.infer<typeof formSchema>;

const EMPTY: FormValues = { company_name: "", position: "", started: { year: null, month: null }, ended: { year: null, month: null }, is_current: false, responsibilities: "", achievements: "" };

function toForm(e: WorkerExperienceRow): FormValues {
  return {
    company_name: e.company_name,
    position: e.position,
    started: isoDateToMonth(e.started_on),
    ended: isoDateToMonth(e.ended_on),
    is_current: e.is_current,
    responsibilities: e.responsibilities ?? "",
    achievements: e.achievements ?? "",
  };
}

export function ExperienceSection({ items }: { items: WorkerExperienceRow[] }) {
  const { t, locale } = useT();
  const { pending, run } = useAction();
  const [editing, setEditing] = useState<WorkerExperienceRow | "new" | null>(null);
  const [deleting, setDeleting] = useState<WorkerExperienceRow | null>(null);

  return (
    <EditSectionCard
      id="experience"
      title={t("profile.sections.experience")}
      footer={
        <Button type="button" variant="soft" onClick={() => setEditing("new")}>
          <Plus className="size-4" /> {t("profile.edit.add_experience")}
        </Button>
      }
    >
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("profile.empty.experience")}</p>
      ) : (
        <ul className="divide-y divide-border">
          {items.map((e) => (
            <li key={e.id} className="flex items-start gap-3 py-3">
              <span className={cn("mt-1 flex size-9 shrink-0 items-center justify-center rounded-lg", e.is_current ? "bg-primary-soft text-primary" : "bg-secondary text-muted-foreground")}>
                <Building2 className="size-4.5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{e.position}</p>
                <p className="text-sm text-muted-foreground">{e.company_name}</p>
                <p className="text-xs text-muted-foreground">{formatExperienceRange(e.started_on, e.ended_on, e.is_current, locale, t("profile.labels.present"))}</p>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button type="button" variant="ghost" size="icon-sm" aria-label={t("common.actions.edit")} onClick={() => setEditing(e)}>
                  <Pencil className="size-4" />
                </Button>
                <Button type="button" variant="ghost" size="icon-sm" aria-label={t("common.actions.delete")} onClick={() => setDeleting(e)}>
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing ? <ExperienceDialog key={editing === "new" ? "new" : editing.id} item={editing === "new" ? null : editing} onClose={() => setEditing(null)} /> : null}

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={t("profile.edit.delete_confirm_title")}
        description={t("profile.edit.delete_confirm_desc")}
        confirmLabel={t("common.actions.delete")}
        cancelLabel={t("common.actions.cancel")}
        destructive
        loading={pending}
        onConfirm={() => {
          if (!deleting) return;
          const id = deleting.id;
          run(() => deleteExperience({ id }), { success: t("profile.toast.deleted"), onSuccess: () => setDeleting(null) });
        }}
      />
    </EditSectionCard>
  );
}

function ExperienceDialog({ item, onClose }: { item: WorkerExperienceRow | null; onClose: () => void }) {
  const { t } = useT();
  const { pending, run } = useAction();
  const form = useForm<FormValues>({ resolver: zodResolver(formSchema), defaultValues: item ? toForm(item) : EMPTY });
  const { errors } = form.formState;
  const isCurrent = useWatch({ control: form.control, name: "is_current" });

  const submit = form.handleSubmit((v) =>
    run(
      () =>
        saveExperience({
          id: item?.id,
          company_name: v.company_name,
          position: v.position,
          started_on: monthToIsoDate(v.started.year, v.started.month),
          ended_on: v.is_current ? null : monthToIsoDate(v.ended.year, v.ended.month),
          is_current: v.is_current,
          responsibilities: v.responsibilities,
          achievements: v.achievements,
        }),
      { onSuccess: onClose },
    ),
  );

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <Sheet
        title={item ? t("profile.edit.edit_experience") : t("profile.edit.add_experience")}
        footer={
          <Button type="submit" form="experience-form" fullWidth loading={pending}>
            {t("common.actions.save")}
          </Button>
        }
      >
        <form id="experience-form" onSubmit={submit} className="space-y-4 pb-2">
          <Field label={t("profile.labels.position")} htmlFor="exp-position" required error={fieldError(t, errors.position?.message, { min: 2, max: 120 })}>
            <Input id="exp-position" invalid={!!errors.position} {...form.register("position")} />
          </Field>
          <Field label={t("profile.labels.company")} htmlFor="exp-company" required error={fieldError(t, errors.company_name?.message, { min: 2, max: 120 })}>
            <Input id="exp-company" invalid={!!errors.company_name} {...form.register("company_name")} />
          </Field>
          <Field label={t("profile.labels.started")} required error={fieldError(t, errors.started?.message ?? errors.started?.root?.message)}>
            <Controller control={form.control} name="started" render={({ field }) => <MonthYearPicker value={field.value as MonthYear} onChange={field.onChange} invalid={!!errors.started} />} />
          </Field>
          <Controller
            control={form.control}
            name="is_current"
            render={({ field }) => <Checkbox checked={field.value} onCheckedChange={(v) => field.onChange(v === true)} label={t("profile.labels.is_current")} />}
          />
          {!isCurrent ? (
            <Field label={t("profile.labels.ended")} required error={fieldError(t, errors.ended?.message ?? errors.ended?.root?.message)}>
              <Controller control={form.control} name="ended" render={({ field }) => <MonthYearPicker value={field.value as MonthYear} onChange={field.onChange} invalid={!!errors.ended} />} />
            </Field>
          ) : null}
          <Field label={t("profile.labels.responsibilities")} htmlFor="exp-resp" hint={t("profile.labels.optional")} error={fieldError(t, errors.responsibilities?.message, { max: 2000 })}>
            <Textarea id="exp-resp" rows={3} maxLength={2000} className="min-h-[90px]" {...form.register("responsibilities")} />
          </Field>
          <Field label={t("profile.labels.achievements")} htmlFor="exp-ach" hint={t("profile.labels.optional")} error={fieldError(t, errors.achievements?.message, { max: 2000 })}>
            <Textarea id="exp-ach" rows={2} maxLength={2000} className="min-h-[70px]" {...form.register("achievements")} />
          </Field>
        </form>
      </Sheet>
    </Dialog>
  );
}
