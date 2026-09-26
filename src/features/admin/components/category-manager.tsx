"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Pencil, Plus, Trash2 } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import type { Tables } from "@/types/database.types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/ui/misc";
import { CategoryIcon } from "@/components/shared/category-icon";
import { cn } from "@/lib/utils";
import { categorySchema, subcategorySchema, type CategoryInput, type SubcategoryInput } from "../schema";
import { deleteCategory, deleteSubcategory, saveCategory, saveSubcategory } from "../actions/reference";
import { CATEGORY_ICONS } from "../icons";
import type { CategoryRow } from "../queries/reference";
import { TableWrap, Th, Td } from "./data-table";
import { RefFormSheet, NameFields, SortActiveFields, issuesToErrors } from "./ref-form";
import { useAdminAction } from "./use-admin-action";

type Cat = Tables<"categories">;
type Sub = Tables<"subcategories">;

const emptyCat = (): CategoryInput => ({ slug: "", name_uz: "", name_ru: "", icon: "briefcase", sort_order: 100, is_active: true, portfolio_recommended: false });
const emptySub = (categoryId: string): SubcategoryInput => ({ category_id: categoryId, slug: "", name_uz: "", name_ru: "", sort_order: 100, is_active: true });

/** Kategoriyalar jadvali: ochiladigan subkategoriyalar, CRUD Sheet formalari */
export function CategoryManager({ categories, canManage }: { categories: CategoryRow[]; canManage: boolean }) {
  const { t, name } = useT();
  const { pending, run } = useAdminAction();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [catForm, setCatForm] = useState<CategoryInput | null>(null);
  const [subForm, setSubForm] = useState<SubcategoryInput | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [del, setDel] = useState<{ kind: "cat" | "sub"; id: string; label: string } | null>(null);

  const toggle = (id: string) => {
    const next = new Set(expanded);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpanded(next);
  };

  const submitCat = () => {
    if (!catForm) return;
    const parsed = categorySchema.safeParse(catForm);
    if (!parsed.success) {
      setErrors(issuesToErrors(parsed.error.issues, t("common.errors.validation")));
      return;
    }
    run(() => saveCategory(parsed.data), { success: t("admin.common.saved"), onOk: () => setCatForm(null) });
  };
  const submitSub = () => {
    if (!subForm) return;
    const parsed = subcategorySchema.safeParse(subForm);
    if (!parsed.success) {
      setErrors(issuesToErrors(parsed.error.issues, t("common.errors.validation")));
      return;
    }
    run(() => saveSubcategory(parsed.data), { success: t("admin.common.saved"), onOk: () => setSubForm(null) });
  };
  const confirmDelete = () => {
    if (!del) return;
    run(() => (del.kind === "cat" ? deleteCategory({ id: del.id }) : deleteSubcategory({ id: del.id })), { success: t("admin.common.deleted"), onOk: () => setDel(null) });
  };
  const editCat = (c: Cat) => {
    setErrors({});
    setCatForm({ id: c.id, slug: c.slug, name_uz: c.name_uz, name_ru: c.name_ru, icon: c.icon ?? "", sort_order: c.sort_order, is_active: c.is_active, portfolio_recommended: c.portfolio_recommended });
  };
  const editSub = (s: Sub) => {
    setErrors({});
    setSubForm({ id: s.id, category_id: s.category_id, slug: s.slug, name_uz: s.name_uz, name_ru: s.name_ru, sort_order: s.sort_order, is_active: s.is_active });
  };

  return (
    <div>
      {canManage ? (
        <div className="mb-3 flex justify-end">
          <Button size="sm" onClick={() => { setErrors({}); setCatForm(emptyCat()); }}>
            <Plus className="size-4" /> {t("admin.categories.add")}
          </Button>
        </div>
      ) : null}
      {categories.length === 0 ? (
        <EmptyState title={t("common.empty.nothing_here")} />
      ) : (
        <TableWrap>
          <thead>
            <tr>
              <Th className="w-10" />
              <Th>{t("admin.categories.col_name")}</Th>
              <Th>Slug</Th>
              <Th align="right">{t("admin.ref.sort_order")}</Th>
              <Th>{t("admin.categories.col_subs")}</Th>
              <Th>{t("admin.vacancies.col_status")}</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {categories.map((c) => {
              const open = expanded.has(c.id);
              return (
                <CategoryRows key={c.id} c={c} open={open} onToggle={() => toggle(c.id)} canManage={canManage} onEdit={() => editCat(c)} onDelete={() => setDel({ kind: "cat", id: c.id, label: name(c) })} onAddSub={() => { setErrors({}); setSubForm(emptySub(c.id)); }} onEditSub={editSub} onDeleteSub={(s) => setDel({ kind: "sub", id: s.id, label: name(s) })} />
              );
            })}
          </tbody>
        </TableWrap>
      )}

      {catForm ? (
        <RefFormSheet open onOpenChange={(o) => !o && setCatForm(null)} title={catForm.id ? t("admin.categories.edit") : t("admin.categories.add")} pending={pending} onSubmit={submitCat}>
          <NameFields value={catForm} onChange={(v) => setCatForm({ ...catForm, ...v })} errors={errors} autoSlug={!catForm.id} />
          <Field label={t("admin.categories.icon")} htmlFor="cat-icon">
            <div className="flex items-center gap-3">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary"><CategoryIcon name={catForm.icon} className="size-6" /></span>
              <Select id="cat-icon" value={catForm.icon ?? ""} onChange={(e) => setCatForm({ ...catForm, icon: e.target.value })} options={CATEGORY_ICONS.map((i) => ({ value: i, label: i }))} placeholder="—" />
            </div>
          </Field>
          <SortActiveFields sort={catForm.sort_order} active={catForm.is_active} onSort={(n) => setCatForm({ ...catForm, sort_order: n })} onActive={(b) => setCatForm({ ...catForm, is_active: b })} error={errors.sort_order} />
          <Field label={t("admin.categories.portfolio_recommended")} description={t("admin.categories.portfolio_hint")}>
            <Switch checked={catForm.portfolio_recommended} onCheckedChange={(b) => setCatForm({ ...catForm, portfolio_recommended: b })} />
          </Field>
        </RefFormSheet>
      ) : null}

      {subForm ? (
        <RefFormSheet open onOpenChange={(o) => !o && setSubForm(null)} title={subForm.id ? t("admin.categories.edit_sub") : t("admin.categories.add_sub")} pending={pending} onSubmit={submitSub}>
          <Field label={t("admin.workers.category")}>
            <Select value={subForm.category_id} onChange={(e) => setSubForm({ ...subForm, category_id: e.target.value })} options={categories.map((c) => ({ value: c.id, label: name(c) }))} />
          </Field>
          <NameFields value={subForm} onChange={(v) => setSubForm({ ...subForm, ...v })} errors={errors} autoSlug={!subForm.id} />
          <SortActiveFields sort={subForm.sort_order} active={subForm.is_active} onSort={(n) => setSubForm({ ...subForm, sort_order: n })} onActive={(b) => setSubForm({ ...subForm, is_active: b })} error={errors.sort_order} />
        </RefFormSheet>
      ) : null}

      <ConfirmDialog
        open={!!del}
        onOpenChange={(o) => !o && setDel(null)}
        title={t("admin.ref.delete_title", { name: del?.label ?? "" })}
        description={del?.kind === "cat" ? t("admin.categories.delete_desc") : t("admin.ref.delete_desc")}
        confirmLabel={t("common.actions.delete")}
        cancelLabel={t("common.actions.cancel")}
        destructive
        loading={pending}
        onConfirm={confirmDelete}
      />
    </div>
  );
}

function CategoryRows({
  c,
  open,
  onToggle,
  canManage,
  onEdit,
  onDelete,
  onAddSub,
  onEditSub,
  onDeleteSub,
}: {
  c: CategoryRow;
  open: boolean;
  onToggle: () => void;
  canManage: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onAddSub: () => void;
  onEditSub: (s: Sub) => void;
  onDeleteSub: (s: Sub) => void;
}) {
  const { t, name } = useT();
  return (
    <>
      <tr className={cn("hover:bg-secondary/40", !c.is_active && "opacity-60")}>
        <Td>
          <button type="button" onClick={onToggle} className="flex size-8 items-center justify-center rounded-lg hover:bg-secondary" aria-expanded={open} aria-label={t("admin.categories.col_subs")}>
            {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
          </button>
        </Td>
        <Td>
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-lg bg-primary-soft text-primary"><CategoryIcon name={c.icon} className="size-4.5" /></span>
            <div className="min-w-0">
              <p className="font-medium">{c.name_uz}</p>
              <p className="text-xs text-muted-foreground">{c.name_ru}</p>
            </div>
            {c.portfolio_recommended ? <Badge variant="primary" size="sm">{t("admin.categories.portfolio_short")}</Badge> : null}
          </div>
        </Td>
        <Td><code className="text-xs">{c.slug}</code></Td>
        <Td align="right">{c.sort_order}</Td>
        <Td>{c.subcategories.length}</Td>
        <Td>{c.is_active ? <Badge variant="success" size="sm">{t("admin.ref.active")}</Badge> : <Badge size="sm">{t("admin.ref.inactive")}</Badge>}</Td>
        <Td align="right">
          {canManage ? (
            <div className="flex items-center justify-end gap-1">
              <Button variant="ghost" size="icon-sm" onClick={onAddSub} aria-label={t("admin.categories.add_sub")}><Plus className="size-4" /></Button>
              <Button variant="ghost" size="icon-sm" onClick={onEdit} aria-label={t("common.actions.edit")}><Pencil className="size-4" /></Button>
              <Button variant="ghost" size="icon-sm" onClick={onDelete} aria-label={t("common.actions.delete")} className="text-destructive"><Trash2 className="size-4" /></Button>
            </div>
          ) : null}
        </Td>
      </tr>
      {open
        ? (c.subcategories.length ? c.subcategories : []).map((s) => (
            <tr key={s.id} className={cn("bg-secondary/30", !s.is_active && "opacity-60")}>
              <Td />
              <Td>
                <div className="pl-6">
                  <p className="text-sm">{name(s)}</p>
                  <p className="text-xs text-muted-foreground">{s.name_uz} / {s.name_ru}</p>
                </div>
              </Td>
              <Td><code className="text-xs">{s.slug}</code></Td>
              <Td align="right">{s.sort_order}</Td>
              <Td />
              <Td>{s.is_active ? <Badge variant="success" size="sm">{t("admin.ref.active")}</Badge> : <Badge size="sm">{t("admin.ref.inactive")}</Badge>}</Td>
              <Td align="right">
                {canManage ? (
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="icon-sm" onClick={() => onEditSub(s)} aria-label={t("common.actions.edit")}><Pencil className="size-4" /></Button>
                    <Button variant="ghost" size="icon-sm" onClick={() => onDeleteSub(s)} aria-label={t("common.actions.delete")} className="text-destructive"><Trash2 className="size-4" /></Button>
                  </div>
                ) : null}
              </Td>
            </tr>
          ))
        : null}
      {open && c.subcategories.length === 0 ? (
        <tr className="bg-secondary/30">
          <Td />
          <Td colSpan={6}><span className="pl-6 text-xs text-muted-foreground">{t("admin.categories.no_subs")}</span></Td>
        </tr>
      ) : null}
    </>
  );
}
