"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { GraduationCap, Pencil, Plus, Trash2 } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, Dialog, Sheet } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Constants } from "@/types/database.types";
import { deleteEducation, saveEducation } from "../../actions";
import { formatYearRange } from "../../pure";
import type { WorkerEducationRow } from "../../queries";
import { useAction } from "../use-action";
import { EditSectionCard } from "./section-card";
import { fieldError, yearOptions } from "./form-utils";

const formSchema = z
  .object({
    level: z.enum(Constants.public.Enums.education_level, { message: "required" }),
    institution: z.string().trim().max(160, "max_length"),
    field: z.string().trim().max(160, "max_length"),
    started_year: z.string(),
    ended_year: z.string(),
  })
  .refine((d) => !d.started_year || !d.ended_year || Number(d.ended_year) >= Number(d.started_year), { message: "invalid_dates", path: ["ended_year"] });
type FormValues = z.infer<typeof formSchema>;

export function EducationSection({ items }: { items: WorkerEducationRow[] }) {
  const { t, tEnum } = useT();
  const { pending, run } = useAction();
  const [editing, setEditing] = useState<WorkerEducationRow | "new" | null>(null);
  const [deleting, setDeleting] = useState<WorkerEducationRow | null>(null);

  return (
    <EditSectionCard
      id="education"
      title={t("profile.sections.education")}
      footer={
        <Button type="button" variant="soft" onClick={() => setEditing("new")}>
          <Plus className="size-4" /> {t("profile.edit.add_education")}
        </Button>
      }
    >
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("profile.empty.education")}</p>
      ) : (
        <ul className="divide-y divide-border">
          {items.map((e) => (
            <li key={e.id} className="flex items-start gap-3 py-3">
              <span className="mt-1 flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
                <GraduationCap className="size-4.5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{e.institution || tEnum("education_level", e.level)}</p>
                <p className="text-sm text-muted-foreground">{[tEnum("education_level", e.level), e.field].filter(Boolean).join(" · ")}</p>
                {formatYearRange(e.started_year, e.ended_year) ? <p className="text-xs text-muted-foreground">{formatYearRange(e.started_year, e.ended_year)}</p> : null}
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

      {editing ? <EducationDialog key={editing === "new" ? "new" : editing.id} item={editing === "new" ? null : editing} onClose={() => setEditing(null)} /> : null}

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
          run(() => deleteEducation({ id }), { success: t("profile.toast.deleted"), onSuccess: () => setDeleting(null) });
        }}
      />
    </EditSectionCard>
  );
}

function EducationDialog({ item, onClose }: { item: WorkerEducationRow | null; onClose: () => void }) {
  const { t, tEnum } = useT();
  const { pending, run } = useAction();
  const years = useMemo(() => yearOptions(1950, new Date().getFullYear() + 6), []);
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: item
      ? { level: item.level, institution: item.institution ?? "", field: item.field ?? "", started_year: item.started_year ? String(item.started_year) : "", ended_year: item.ended_year ? String(item.ended_year) : "" }
      : { level: "higher", institution: "", field: "", started_year: "", ended_year: "" },
  });
  const { errors } = form.formState;

  const submit = form.handleSubmit((v) =>
    run(
      () =>
        saveEducation({
          id: item?.id,
          level: v.level,
          institution: v.institution,
          field: v.field,
          started_year: v.started_year ? Number(v.started_year) : null,
          ended_year: v.ended_year ? Number(v.ended_year) : null,
        }),
      { onSuccess: onClose },
    ),
  );

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <Sheet
        title={item ? t("profile.edit.edit_education") : t("profile.edit.add_education")}
        footer={
          <Button type="submit" form="education-form" fullWidth loading={pending}>
            {t("common.actions.save")}
          </Button>
        }
      >
        <form id="education-form" onSubmit={submit} className="space-y-4 pb-2">
          <Field label={t("profile.labels.education_level")} htmlFor="edu-level" required error={fieldError(t, errors.level?.message)}>
            <Select id="edu-level" options={Constants.public.Enums.education_level.map((l) => ({ value: l, label: tEnum("education_level", l) }))} {...form.register("level")} />
          </Field>
          <Field label={t("profile.labels.institution")} htmlFor="edu-inst" hint={t("profile.labels.optional")} error={fieldError(t, errors.institution?.message, { max: 160 })}>
            <Input id="edu-inst" maxLength={160} {...form.register("institution")} />
          </Field>
          <Field label={t("profile.labels.field")} htmlFor="edu-field" hint={t("profile.labels.optional")} error={fieldError(t, errors.field?.message, { max: 160 })}>
            <Input id="edu-field" maxLength={160} {...form.register("field")} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("profile.labels.started_year")} htmlFor="edu-start">
              <Select id="edu-start" placeholder="—" options={years} {...form.register("started_year")} />
            </Field>
            <Field label={t("profile.labels.ended_year")} htmlFor="edu-end" error={fieldError(t, errors.ended_year?.message)}>
              <Select id="edu-end" placeholder="—" options={years} invalid={!!errors.ended_year} {...form.register("ended_year")} />
            </Field>
          </div>
        </form>
      </Sheet>
    </Dialog>
  );
}
