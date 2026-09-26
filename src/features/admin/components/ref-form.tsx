"use client";

import type { ReactNode } from "react";
import { useT } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";
import { Dialog, Sheet } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Switch } from "@/components/ui/checkbox";

/** Ma'lumotnoma formasi qobig'i (Sheet + Saqlash/Bekor) */
export function RefFormSheet({ open, onOpenChange, title, pending, onSubmit, children }: { open: boolean; onOpenChange: (o: boolean) => void; title: string; pending: boolean; onSubmit: () => void; children: ReactNode }) {
  const { t } = useT();
  return (
    <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <Sheet
        title={title}
        footer={
          <div className="flex gap-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => onOpenChange(false)} disabled={pending}>
              {t("common.actions.cancel")}
            </Button>
            <Button type="button" className="flex-1" onClick={onSubmit} loading={pending}>
              {t("common.actions.save")}
            </Button>
          </div>
        }
      >
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit();
          }}
        >
          {children}
          <button type="submit" className="hidden" aria-hidden />
        </form>
      </Sheet>
    </Dialog>
  );
}

/** Ikki tildagi nom + slug maydonlari */
export function NameFields({
  value,
  onChange,
  errors,
  autoSlug,
}: {
  value: { slug: string; name_uz: string; name_ru: string };
  onChange: (next: { slug: string; name_uz: string; name_ru: string }) => void;
  errors: Record<string, string | undefined>;
  autoSlug?: boolean;
}) {
  const { t } = useT();
  const slugify = (s: string) =>
    s
      .toLowerCase()
      .replace(/['ʼ’`]/g, "")
      .replace(/[^a-z0-9а-яёўқғҳ]+/g, "-")
      .replace(/^-+|-+$/g, "");
  return (
    <>
      <Field label={t("admin.ref.name_uz")} htmlFor="rf-uz" required error={errors.name_uz}>
        <Input id="rf-uz" value={value.name_uz} onChange={(e) => onChange({ ...value, name_uz: e.target.value, slug: autoSlug && !value.slug ? slugify(e.target.value) : value.slug })} invalid={!!errors.name_uz} maxLength={120} />
      </Field>
      <Field label={t("admin.ref.name_ru")} htmlFor="rf-ru" required error={errors.name_ru}>
        <Input id="rf-ru" value={value.name_ru} onChange={(e) => onChange({ ...value, name_ru: e.target.value })} invalid={!!errors.name_ru} maxLength={120} />
      </Field>
      <Field label="Slug" htmlFor="rf-slug" required error={errors.slug} description={t("admin.ref.slug_hint")}>
        <Input id="rf-slug" value={value.slug} onChange={(e) => onChange({ ...value, slug: e.target.value })} invalid={!!errors.slug} maxLength={60} className="font-mono text-sm" />
      </Field>
    </>
  );
}

export function SortActiveFields({ sort, active, onSort, onActive, error }: { sort: number; active: boolean; onSort: (n: number) => void; onActive: (b: boolean) => void; error?: string }) {
  const { t } = useT();
  return (
    <div className="grid grid-cols-2 gap-3">
      <Field label={t("admin.ref.sort_order")} htmlFor="rf-sort" error={error}>
        <Input id="rf-sort" type="number" min={0} max={10000} value={sort} onChange={(e) => onSort(Number(e.target.value))} />
      </Field>
      <Field label={t("admin.ref.is_active")}>
        <div className="flex h-12 items-center">
          <Switch checked={active} onCheckedChange={onActive} aria-label={t("admin.ref.is_active")} />
        </div>
      </Field>
    </div>
  );
}

/** zod issue'larni { field: message } ga aylantiradi */
export function issuesToErrors(issues: { path: PropertyKey[]; message: string }[], msg: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of issues) {
    const k = i.path[0];
    if (typeof k === "string" && !(k in out)) out[k] = msg;
  }
  return out;
}
