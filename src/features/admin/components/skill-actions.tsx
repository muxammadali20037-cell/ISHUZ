"use client";

import { useState } from "react";
import { Check, Pencil, Trash2, X } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/checkbox";
import { skillUpdateSchema, type SkillUpdateInput } from "../schema";
import { deleteSkill, setSkillApproved, updateSkill } from "../actions/reference";
import type { SkillRow } from "../queries/reference";
import { RefFormSheet, issuesToErrors } from "./ref-form";
import { useAdminAction } from "./use-admin-action";

/** Ko'nikma qatori amallari: tasdiqlash/bekor, tahrirlash (Sheet), o'chirish */
export function SkillActions({ skill, categories, canManage }: { skill: SkillRow; categories: { id: string; name_uz: string; name_ru: string }[]; canManage: boolean }) {
  const { t, name } = useT();
  const { pending, run } = useAdminAction();
  const [form, setForm] = useState<SkillUpdateInput | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [del, setDel] = useState(false);
  if (!canManage) return null;

  const submit = () => {
    if (!form) return;
    const parsed = skillUpdateSchema.safeParse(form);
    if (!parsed.success) {
      setErrors(issuesToErrors(parsed.error.issues, t("common.errors.validation")));
      return;
    }
    run(() => updateSkill(parsed.data), { success: t("admin.common.saved"), onOk: () => setForm(null) });
  };

  return (
    <div className="flex items-center justify-end gap-1">
      {skill.is_approved ? (
        <Button variant="ghost" size="sm" onClick={() => run(() => setSkillApproved({ id: skill.id, approved: false }), { success: t("admin.skills.unapproved_done") })} disabled={pending}>
          <X className="size-4" /> {t("admin.skills.unapprove")}
        </Button>
      ) : (
        <Button variant="success" size="sm" onClick={() => run(() => setSkillApproved({ id: skill.id, approved: true }), { success: t("admin.skills.approved_done") })} disabled={pending}>
          <Check className="size-4" /> {t("admin.skills.approve")}
        </Button>
      )}
      <Button variant="ghost" size="icon-sm" aria-label={t("common.actions.edit")} onClick={() => { setErrors({}); setForm({ id: skill.id, name_uz: skill.name_uz, name_ru: skill.name_ru, category_id: skill.category_id, is_approved: skill.is_approved }); }}>
        <Pencil className="size-4" />
      </Button>
      <Button variant="ghost" size="icon-sm" aria-label={t("common.actions.delete")} className="text-destructive" onClick={() => setDel(true)}>
        <Trash2 className="size-4" />
      </Button>

      {form ? (
        <RefFormSheet open onOpenChange={(o) => !o && setForm(null)} title={t("admin.skills.edit")} pending={pending} onSubmit={submit}>
          <Field label={t("admin.ref.name_uz")} htmlFor="sk-uz" required error={errors.name_uz}>
            <Input id="sk-uz" value={form.name_uz} onChange={(e) => setForm({ ...form, name_uz: e.target.value })} invalid={!!errors.name_uz} maxLength={120} />
          </Field>
          <Field label={t("admin.ref.name_ru")} htmlFor="sk-ru" required error={errors.name_ru}>
            <Input id="sk-ru" value={form.name_ru} onChange={(e) => setForm({ ...form, name_ru: e.target.value })} invalid={!!errors.name_ru} maxLength={120} />
          </Field>
          <Field label={t("admin.workers.category")} htmlFor="sk-cat">
            <Select id="sk-cat" value={form.category_id ?? ""} onChange={(e) => setForm({ ...form, category_id: e.target.value || null })} options={categories.map((c) => ({ value: c.id, label: name(c) }))} placeholder={t("admin.skills.no_category")} />
          </Field>
          <Field label={t("admin.skills.col_approved")}>
            <Switch checked={form.is_approved} onCheckedChange={(b) => setForm({ ...form, is_approved: b })} />
          </Field>
          <p className="text-xs text-muted-foreground">Slug: <code>{skill.slug}</code> · {t("admin.skills.usage", { count: skill.usage_count })}</p>
        </RefFormSheet>
      ) : null}

      <ConfirmDialog
        open={del}
        onOpenChange={setDel}
        title={t("admin.ref.delete_title", { name: name(skill) })}
        description={t("admin.skills.delete_desc", { count: skill.usage_count })}
        confirmLabel={t("common.actions.delete")}
        cancelLabel={t("common.actions.cancel")}
        destructive
        loading={pending}
        onConfirm={() => run(() => deleteSkill({ id: skill.id }), { success: t("admin.common.deleted"), onOk: () => setDel(false) })}
      />
    </div>
  );
}
