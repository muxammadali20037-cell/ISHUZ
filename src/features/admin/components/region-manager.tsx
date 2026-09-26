"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import type { Tables } from "@/types/database.types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { EmptyState } from "@/components/ui/misc";
import { cn } from "@/lib/utils";
import { districtSchema, regionSchema, type DistrictInput, type RegionInput } from "../schema";
import { deleteDistrict, deleteRegion, saveDistrict, saveRegion } from "../actions/reference";
import type { RegionRow } from "../queries/reference";
import { TableWrap, Th, Td } from "./data-table";
import { RefFormSheet, NameFields, SortActiveFields, issuesToErrors } from "./ref-form";
import { useAdminAction } from "./use-admin-action";

type District = Tables<"districts">;

const emptyRegion = (): RegionInput => ({ slug: "", name_uz: "", name_ru: "", sort_order: 100, is_active: true });
const emptyDistrict = (regionId: string): DistrictInput => ({ region_id: regionId, slug: "", name_uz: "", name_ru: "", lat: null, lng: null, sort_order: 100, is_active: true });

/** Viloyatlar + tumanlar CRUD (regions.manage) */
export function RegionManager({ regions, canManage }: { regions: RegionRow[]; canManage: boolean }) {
  const { t, name } = useT();
  const { pending, run } = useAdminAction();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [regionForm, setRegionForm] = useState<RegionInput | null>(null);
  const [districtForm, setDistrictForm] = useState<DistrictInput | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [del, setDel] = useState<{ kind: "region" | "district"; id: string; label: string } | null>(null);

  const toggle = (id: string) => {
    const next = new Set(expanded);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpanded(next);
  };
  const submitRegion = () => {
    if (!regionForm) return;
    const parsed = regionSchema.safeParse(regionForm);
    if (!parsed.success) return setErrors(issuesToErrors(parsed.error.issues, t("common.errors.validation")));
    run(() => saveRegion(parsed.data), { success: t("admin.common.saved"), onOk: () => setRegionForm(null) });
  };
  const submitDistrict = () => {
    if (!districtForm) return;
    const parsed = districtSchema.safeParse({ ...districtForm, lat: districtForm.lat === null || (districtForm.lat as unknown) === "" ? null : districtForm.lat, lng: districtForm.lng === null || (districtForm.lng as unknown) === "" ? null : districtForm.lng });
    if (!parsed.success) return setErrors(issuesToErrors(parsed.error.issues, t("common.errors.validation")));
    run(() => saveDistrict(parsed.data), { success: t("admin.common.saved"), onOk: () => setDistrictForm(null) });
  };

  return (
    <div>
      {canManage ? (
        <div className="mb-3 flex justify-end">
          <Button size="sm" onClick={() => { setErrors({}); setRegionForm(emptyRegion()); }}>
            <Plus className="size-4" /> {t("admin.regions.add")}
          </Button>
        </div>
      ) : null}
      {regions.length === 0 ? (
        <EmptyState title={t("common.empty.nothing_here")} />
      ) : (
        <TableWrap>
          <thead>
            <tr>
              <Th className="w-10" />
              <Th>{t("admin.regions.col_name")}</Th>
              <Th>Slug</Th>
              <Th>{t("admin.regions.coords")}</Th>
              <Th align="right">{t("admin.ref.sort_order")}</Th>
              <Th>{t("admin.regions.col_districts")}</Th>
              <Th>{t("admin.vacancies.col_status")}</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {regions.map((r) => {
              const open = expanded.has(r.id);
              return (
                <RegionRows
                  key={r.id}
                  r={r}
                  open={open}
                  onToggle={() => toggle(r.id)}
                  canManage={canManage}
                  onEdit={() => { setErrors({}); setRegionForm({ id: r.id, slug: r.slug, name_uz: r.name_uz, name_ru: r.name_ru, sort_order: r.sort_order, is_active: r.is_active }); }}
                  onDelete={() => setDel({ kind: "region", id: r.id, label: name(r) })}
                  onAddDistrict={() => { setErrors({}); setDistrictForm(emptyDistrict(r.id)); }}
                  onEditDistrict={(d) => { setErrors({}); setDistrictForm({ id: d.id, region_id: d.region_id, slug: d.slug, name_uz: d.name_uz, name_ru: d.name_ru, lat: d.lat, lng: d.lng, sort_order: d.sort_order, is_active: d.is_active }); }}
                  onDeleteDistrict={(d) => setDel({ kind: "district", id: d.id, label: name(d) })}
                />
              );
            })}
          </tbody>
        </TableWrap>
      )}

      {regionForm ? (
        <RefFormSheet open onOpenChange={(o) => !o && setRegionForm(null)} title={regionForm.id ? t("admin.regions.edit") : t("admin.regions.add")} pending={pending} onSubmit={submitRegion}>
          <NameFields value={regionForm} onChange={(v) => setRegionForm({ ...regionForm, ...v })} errors={errors} autoSlug={!regionForm.id} />
          <SortActiveFields sort={regionForm.sort_order} active={regionForm.is_active} onSort={(n) => setRegionForm({ ...regionForm, sort_order: n })} onActive={(b) => setRegionForm({ ...regionForm, is_active: b })} error={errors.sort_order} />
        </RefFormSheet>
      ) : null}

      {districtForm ? (
        <RefFormSheet open onOpenChange={(o) => !o && setDistrictForm(null)} title={districtForm.id ? t("admin.regions.edit_district") : t("admin.regions.add_district")} pending={pending} onSubmit={submitDistrict}>
          <Field label={t("admin.regions.region")}>
            <Select value={districtForm.region_id} onChange={(e) => setDistrictForm({ ...districtForm, region_id: e.target.value })} options={regions.map((r) => ({ value: r.id, label: name(r) }))} />
          </Field>
          <NameFields value={districtForm} onChange={(v) => setDistrictForm({ ...districtForm, ...v })} errors={errors} autoSlug={!districtForm.id} />
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("admin.regions.lat")} htmlFor="d-lat" error={errors.lat}>
              <Input id="d-lat" type="number" step="0.000001" min={-90} max={90} value={districtForm.lat ?? ""} onChange={(e) => setDistrictForm({ ...districtForm, lat: e.target.value === "" ? null : Number(e.target.value) })} placeholder="41.311" />
            </Field>
            <Field label={t("admin.regions.lng")} htmlFor="d-lng" error={errors.lng}>
              <Input id="d-lng" type="number" step="0.000001" min={-180} max={180} value={districtForm.lng ?? ""} onChange={(e) => setDistrictForm({ ...districtForm, lng: e.target.value === "" ? null : Number(e.target.value) })} placeholder="69.279" />
            </Field>
          </div>
          <SortActiveFields sort={districtForm.sort_order} active={districtForm.is_active} onSort={(n) => setDistrictForm({ ...districtForm, sort_order: n })} onActive={(b) => setDistrictForm({ ...districtForm, is_active: b })} error={errors.sort_order} />
        </RefFormSheet>
      ) : null}

      <ConfirmDialog
        open={!!del}
        onOpenChange={(o) => !o && setDel(null)}
        title={t("admin.ref.delete_title", { name: del?.label ?? "" })}
        description={del?.kind === "region" ? t("admin.regions.delete_desc") : t("admin.ref.delete_desc")}
        confirmLabel={t("common.actions.delete")}
        cancelLabel={t("common.actions.cancel")}
        destructive
        loading={pending}
        onConfirm={() => {
          if (del) run(() => (del.kind === "region" ? deleteRegion({ id: del.id }) : deleteDistrict({ id: del.id })), { success: t("admin.common.deleted"), onOk: () => setDel(null) });
        }}
      />
    </div>
  );
}

function RegionRows({
  r,
  open,
  onToggle,
  canManage,
  onEdit,
  onDelete,
  onAddDistrict,
  onEditDistrict,
  onDeleteDistrict,
}: {
  r: RegionRow;
  open: boolean;
  onToggle: () => void;
  canManage: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onAddDistrict: () => void;
  onEditDistrict: (d: District) => void;
  onDeleteDistrict: (d: District) => void;
}) {
  const { t } = useT();
  const status = (active: boolean) => (active ? <Badge variant="success" size="sm">{t("admin.ref.active")}</Badge> : <Badge size="sm">{t("admin.ref.inactive")}</Badge>);
  return (
    <>
      <tr className={cn("hover:bg-secondary/40", !r.is_active && "opacity-60")}>
        <Td>
          <button type="button" onClick={onToggle} className="flex size-8 items-center justify-center rounded-lg hover:bg-secondary" aria-expanded={open} aria-label={t("admin.regions.col_districts")}>
            {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
          </button>
        </Td>
        <Td>
          <p className="font-medium">{r.name_uz}</p>
          <p className="text-xs text-muted-foreground">{r.name_ru}</p>
        </Td>
        <Td><code className="text-xs">{r.slug}</code></Td>
        <Td />
        <Td align="right">{r.sort_order}</Td>
        <Td>{r.districts.length}</Td>
        <Td>{status(r.is_active)}</Td>
        <Td align="right">
          {canManage ? (
            <div className="flex items-center justify-end gap-1">
              <Button variant="ghost" size="icon-sm" onClick={onAddDistrict} aria-label={t("admin.regions.add_district")}><Plus className="size-4" /></Button>
              <Button variant="ghost" size="icon-sm" onClick={onEdit} aria-label={t("common.actions.edit")}><Pencil className="size-4" /></Button>
              <Button variant="ghost" size="icon-sm" onClick={onDelete} aria-label={t("common.actions.delete")} className="text-destructive"><Trash2 className="size-4" /></Button>
            </div>
          ) : null}
        </Td>
      </tr>
      {open
        ? r.districts.map((d) => (
            <tr key={d.id} className={cn("bg-secondary/30", !d.is_active && "opacity-60")}>
              <Td />
              <Td>
                <div className="pl-6">
                  <p className="text-sm">{d.name_uz}</p>
                  <p className="text-xs text-muted-foreground">{d.name_ru}</p>
                </div>
              </Td>
              <Td><code className="text-xs">{d.slug}</code></Td>
              <Td>
                {d.lat !== null && d.lng !== null ? (
                  <a href={`https://www.openstreetmap.org/?mlat=${d.lat}&mlon=${d.lng}#map=13/${d.lat}/${d.lng}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline tabular">
                    <MapPin className="size-3" /> {d.lat.toFixed(4)}, {d.lng.toFixed(4)}
                  </a>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </Td>
              <Td align="right">{d.sort_order}</Td>
              <Td />
              <Td>{status(d.is_active)}</Td>
              <Td align="right">
                {canManage ? (
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="icon-sm" onClick={() => onEditDistrict(d)} aria-label={t("common.actions.edit")}><Pencil className="size-4" /></Button>
                    <Button variant="ghost" size="icon-sm" onClick={() => onDeleteDistrict(d)} aria-label={t("common.actions.delete")} className="text-destructive"><Trash2 className="size-4" /></Button>
                  </div>
                ) : null}
              </Td>
            </tr>
          ))
        : null}
      {open && r.districts.length === 0 ? (
        <tr className="bg-secondary/30">
          <Td />
          <Td colSpan={7}><span className="pl-6 text-xs text-muted-foreground">{t("admin.regions.no_districts")}</span></Td>
        </tr>
      ) : null}
    </>
  );
}
