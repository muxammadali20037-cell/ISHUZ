"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, GitMerge, MoveRight, Pencil, Plus, Search, Star } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Field } from "@/components/ui/label";
import { Input, Textarea } from "@/components/ui/input";
import { Switch } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/ui/misc";
import type { ProfessionSearchHit } from "@/features/professions/types";
import { mergeProfessionNode, moveProfessionNode, saveProfessionNode } from "../actions/professions";
import { TableWrap, Th, Td } from "./data-table";
import { RefFormSheet } from "./ref-form";
import { useAdminAction } from "./use-admin-action";

export interface AdminNode {
  id: string;
  parent_id: string | null;
  category_id: string;
  name_uz: string;
  name_ru: string;
  name_en: string | null;
  icon: string | null;
  aliases: string[];
  selectable: boolean;
  is_popular: boolean;
  is_active: boolean;
  sort_order: number;
  children: number;
  vacancies: number;
  profiles: number;
}

interface FormState {
  id?: string;
  parentId: string | null;
  categoryId: string;
  nameUz: string;
  nameRu: string;
  nameEn: string;
  icon: string;
  aliases: string;
  selectable: boolean;
  isPopular: boolean;
  isActive: boolean;
  sortOrder: number;
}

const fromNode = (n: AdminNode): FormState => ({
  id: n.id,
  parentId: n.parent_id,
  categoryId: n.category_id,
  nameUz: n.name_uz,
  nameRu: n.name_ru,
  nameEn: n.name_en ?? "",
  icon: n.icon ?? "",
  aliases: n.aliases.join(", "),
  selectable: n.selectable,
  isPopular: n.is_popular,
  isActive: n.is_active,
  sortOrder: n.sort_order,
});

/**
 * Kasblar daraxti boshqaruvi: joriy darajadagi tugunlar (yo'l bo'ylab), qo'shish, tahrirlash,
 * ko'chirish, birlashtirish. Kod o'zgartirmasdan yangi kasb/yo'nalish qo'shiladi.
 */
export function ProfessionTreeManager({
  categoryId,
  parent,
  trail,
  nodes,
  canManage,
}: {
  categoryId: string;
  parent: { id: string; name: string } | null;
  trail: { id: string; name: string }[];
  nodes: AdminNode[];
  canManage: boolean;
}) {
  const { t, name } = useT();
  const { pending, run } = useAdminAction();
  const [form, setForm] = useState<FormState | null>(null);
  const [target, setTarget] = useState<{ mode: "move" | "merge"; node: AdminNode } | null>(null);
  const hrefFor = (nodeId: string | null) => `/admin/professions?category=${categoryId}${nodeId ? `&node=${nodeId}` : ""}`;

  const newChild = (): FormState => ({
    parentId: parent?.id ?? null,
    categoryId,
    nameUz: "",
    nameRu: "",
    nameEn: "",
    icon: "",
    aliases: "",
    selectable: true,
    isPopular: false,
    isActive: true,
    sortOrder: (nodes.at(-1)?.sort_order ?? 0) + 10,
  });

  return (
    <div className="space-y-4">
      <nav className="flex flex-wrap items-center gap-1 text-sm" aria-label="breadcrumb">
        <Link href={hrefFor(null)} className="rounded-lg px-1.5 py-1 font-medium text-primary hover:bg-primary-soft">
          {t("admin.professions.root")}
        </Link>
        {trail.map((c) => (
          <span key={c.id} className="inline-flex items-center gap-1">
            <ChevronRight className="size-3.5 text-muted-foreground" />
            <Link href={hrefFor(c.id)} className="rounded-lg px-1.5 py-1 text-primary hover:bg-primary-soft">
              {c.name}
            </Link>
          </span>
        ))}
      </nav>

      {canManage ? (
        <Button onClick={() => setForm(newChild())}>
          <Plus className="size-4" /> {parent ? t("admin.professions.add_child", { name: parent.name }) : t("admin.professions.add_root")}
        </Button>
      ) : null}

      {nodes.length ? (
        <TableWrap>
          <thead>
            <tr>
              <Th>{t("admin.professions.col_name")}</Th>
              <Th>{t("admin.professions.col_flags")}</Th>
              <Th align="right">{t("admin.professions.col_usage")}</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {nodes.map((n) => (
              <tr key={n.id} className={n.is_active ? undefined : "opacity-50"}>
                <Td>
                  <Link href={hrefFor(n.id)} className="font-medium hover:text-primary hover:underline">
                    {name(n)}
                  </Link>
                  <div className="text-xs text-muted-foreground">
                    {n.name_ru}
                    {n.name_en ? ` · ${n.name_en}` : ""}
                    {n.children ? ` · ${t("admin.professions.children", { count: n.children })}` : ""}
                  </div>
                  {n.aliases.length ? <div className="mt-0.5 max-w-md truncate text-xs text-muted-foreground">≈ {n.aliases.slice(0, 6).join(", ")}</div> : null}
                </Td>
                <Td>
                  <div className="flex flex-wrap gap-1">
                    <Badge variant={n.selectable ? "success" : "default"}>{n.selectable ? t("admin.professions.selectable") : t("admin.professions.group")}</Badge>
                    {n.is_popular ? (
                      <Badge variant="warning">
                        <Star className="size-3" /> {t("admin.professions.popular")}
                      </Badge>
                    ) : null}
                    {!n.is_active ? <Badge variant="default">{t("admin.professions.inactive")}</Badge> : null}
                  </div>
                </Td>
                <Td align="right" className="text-sm tabular">
                  {t("admin.professions.usage", { vacancies: n.vacancies, profiles: n.profiles })}
                </Td>
                <Td>
                  {canManage ? (
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => setForm(fromNode(n))} aria-label={t("common.actions.edit")}>
                        <Pencil className="size-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setTarget({ mode: "move", node: n })} aria-label={t("admin.professions.move")}>
                        <MoveRight className="size-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setTarget({ mode: "merge", node: n })} aria-label={t("admin.professions.merge")}>
                        <GitMerge className="size-4" />
                      </Button>
                    </div>
                  ) : null}
                </Td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      ) : (
        <EmptyState title={t("admin.professions.empty")} />
      )}

      {form ? (
        <RefFormSheet
          open
          onOpenChange={(o) => !o && setForm(null)}
          title={form.id ? t("admin.professions.edit") : t("admin.professions.create")}
          pending={pending}
          onSubmit={() => run(() => saveProfessionNode(form), { onOk: () => setForm(null) })}
        >
          <div className="space-y-4">
            <Field label="O'zbekcha" htmlFor="pn-uz" required>
              <Input id="pn-uz" value={form.nameUz} onChange={(e) => setForm({ ...form, nameUz: e.target.value })} />
            </Field>
            <Field label="Русский" htmlFor="pn-ru" required>
              <Input id="pn-ru" value={form.nameRu} onChange={(e) => setForm({ ...form, nameRu: e.target.value })} />
            </Field>
            <Field label="English" htmlFor="pn-en">
              <Input id="pn-en" value={form.nameEn} onChange={(e) => setForm({ ...form, nameEn: e.target.value })} />
            </Field>
            <Field label={t("admin.professions.aliases")} htmlFor="pn-aliases" description={t("admin.professions.aliases_hint")}>
              <Textarea id="pn-aliases" rows={3} value={form.aliases} onChange={(e) => setForm({ ...form, aliases: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("admin.professions.icon")} htmlFor="pn-icon" description="lucide">
                <Input id="pn-icon" value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} placeholder="stethoscope" />
              </Field>
              <Field label={t("admin.ref.sort_order")} htmlFor="pn-sort">
                <Input id="pn-sort" type="number" min={0} value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) || 0 })} />
              </Field>
            </div>
            <Toggle label={t("admin.professions.selectable_hint")} checked={form.selectable} onChange={(v) => setForm({ ...form, selectable: v })} />
            <Toggle label={t("admin.professions.popular")} checked={form.isPopular} onChange={(v) => setForm({ ...form, isPopular: v })} />
            <Toggle label={t("admin.ref.is_active")} checked={form.isActive} onChange={(v) => setForm({ ...form, isActive: v })} />
          </div>
        </RefFormSheet>
      ) : null}

      {target ? (
        <NodeTargetSheet
          mode={target.mode}
          node={target.node}
          pending={pending}
          onClose={() => setTarget(null)}
          onPick={(dest) =>
            run(() => (target.mode === "move" ? moveProfessionNode({ id: target.node.id, parentId: dest }) : mergeProfessionNode({ from: target.node.id, into: dest! })), {
              onOk: () => setTarget(null),
            })
          }
        />
      ) : null}
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2.5 text-sm">
      <span>{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} aria-label={label} />
    </label>
  );
}

/** Ko'chirish (yangi ota) yoki birlashtirish (qaysi tugunga) uchun qidirib tanlash */
function NodeTargetSheet({ mode, node, pending, onClose, onPick }: { mode: "move" | "merge"; node: AdminNode; pending: boolean; onClose: () => void; onPick: (dest: string | null) => void }) {
  const { t, name } = useT();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<ProfessionSearchHit[]>([]);
  const [chosen, setChosen] = useState<string | null>(null);

  useEffect(() => {
    const query = q.trim();
    if (query.length < 2) return;
    const id = window.setTimeout(() => {
      fetch(`/api/professions/search?q=${encodeURIComponent(query)}&category=${node.category_id}`)
        .then((r) => r.json())
        .then(({ results }: { results: ProfessionSearchHit[] }) => setHits((results ?? []).filter((h) => h.id !== node.id)))
        .catch(() => setHits([]));
    }, 250);
    return () => window.clearTimeout(id);
  }, [q, node.id, node.category_id]);

  return (
    <RefFormSheet
      open
      onOpenChange={(o) => !o && onClose()}
      title={t(mode === "move" ? "admin.professions.move_title" : "admin.professions.merge_title", { name: name(node) })}
      pending={pending}
      onSubmit={() => (mode === "move" || chosen) && onPick(chosen)}
    >
      <p className="mb-3 text-sm text-muted-foreground">{t(mode === "move" ? "admin.professions.move_hint" : "admin.professions.merge_hint")}</p>
      <Input leftIcon={<Search />} value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("professions.search_placeholder")} />
      <ul className="mt-3 space-y-1.5">
        {mode === "move" ? (
          <li>
            <button type="button" onClick={() => setChosen(null)} className={`w-full rounded-xl border px-3 py-2 text-left text-sm ${chosen === null ? "border-primary bg-primary-soft" : "border-border"}`}>
              {t("admin.professions.to_root")}
            </button>
          </li>
        ) : null}
        {hits.map((h) => (
          <li key={h.id}>
            <button type="button" onClick={() => setChosen(h.id)} className={`w-full rounded-xl border px-3 py-2 text-left text-sm ${chosen === h.id ? "border-primary bg-primary-soft" : "border-border"}`}>
              <span className="font-medium">{name(h)}</span>
              <span className="block truncate text-xs text-muted-foreground">{h.trail.map((x) => name(x)).join(" › ")}</span>
            </button>
          </li>
        ))}
      </ul>
    </RefFormSheet>
  );
}
