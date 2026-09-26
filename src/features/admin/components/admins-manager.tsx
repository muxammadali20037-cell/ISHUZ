"use client";

import { useState } from "react";
import { Pencil, Plus, UserMinus, UserCheck } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { formatDateTime, fullName, initials } from "@/lib/format";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/ui/misc";
import { cn } from "@/lib/utils";
import { PERMISSIONS, rolePermissions, type AdminRole } from "../permissions";
import { ADMIN_ROLE_VALUES, adminUpsertSchema, type AdminUpsertInput } from "../schema";
import { setAdminActive, upsertAdminUser } from "../actions/settings";
import type { AdminUserRow } from "../queries/settings";
import { TableWrap, Th, Td } from "./data-table";
import { RefFormSheet, issuesToErrors } from "./ref-form";
import { useAdminAction } from "./use-admin-action";

/** admin_users boshqaruvi (faqat admins.manage = super_admin yozadi) */
export function AdminsManager({ admins, canManage, selfId }: { admins: AdminUserRow[]; canManage: boolean; selfId: string }) {
  const { t, tEnum } = useT();
  const { pending, run } = useAdminAction();
  const [form, setForm] = useState<(AdminUpsertInput & { isNew: boolean }) | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [toggle, setToggle] = useState<{ id: string; name: string; active: boolean } | null>(null);

  const submit = () => {
    if (!form) return;
    const parsed = adminUpsertSchema.safeParse(form);
    if (!parsed.success) return setErrors(issuesToErrors(parsed.error.issues, t("common.errors.validation")));
    run(() => upsertAdminUser(parsed.data), { success: t("admin.common.saved"), onOk: () => setForm(null) });
  };
  const rolePerms = form ? rolePermissions(form.role) : [];

  return (
    <div>
      {canManage ? (
        <div className="mb-3 flex justify-end">
          <Button size="sm" onClick={() => { setErrors({}); setForm({ isNew: true, profileId: "", role: "support", permissions: [], is_active: true }); }}>
            <Plus className="size-4" /> {t("admin.admins.add")}
          </Button>
        </div>
      ) : null}
      {admins.length === 0 ? (
        <EmptyState title={t("common.empty.nothing_here")} />
      ) : (
        <TableWrap>
          <thead>
            <tr>
              <Th>{t("admin.users.col_user")}</Th>
              <Th>{t("admin.admins.col_role")}</Th>
              <Th>{t("admin.admins.col_permissions")}</Th>
              <Th>{t("admin.vacancies.col_status")}</Th>
              <Th>{t("admin.users.col_created")}</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {admins.map((a) => (
              <tr key={a.profile_id} className={cn("hover:bg-secondary/40", !a.is_active && "opacity-60")}>
                <Td>
                  <div className="flex items-center gap-2.5">
                    <Avatar src={a.profile?.avatar_url} fallback={initials(a.profile?.first_name, a.profile?.last_name)} size="sm" />
                    <div className="min-w-0">
                      <p className="truncate font-medium">{fullName(a.profile?.first_name, a.profile?.last_name) || "—"}{a.profile_id === selfId ? <span className="ml-1 text-xs text-muted-foreground">({t("admin.admins.you")})</span> : null}</p>
                      <code className="text-[11px] text-muted-foreground">{a.profile_id}</code>
                    </div>
                  </div>
                </Td>
                <Td><Badge variant={a.role === "super_admin" ? "solid" : "primary"} size="sm">{tEnum("admin_role", a.role)}</Badge></Td>
                <Td>
                  <div className="flex max-w-[280px] flex-wrap gap-1">
                    {a.permissions.length ? a.permissions.map((p) => <Badge key={p} variant="outline" size="sm"><code>{p}</code></Badge>) : <span className="text-xs text-muted-foreground">{t("admin.admins.role_defaults")}</span>}
                  </div>
                </Td>
                <Td>{a.is_active ? <Badge variant="success" size="sm">{t("admin.ref.active")}</Badge> : <Badge size="sm">{t("admin.ref.inactive")}</Badge>}</Td>
                <Td className="text-xs text-muted-foreground">
                  {formatDateTime(a.created_at)}
                  {a.creator ? <span className="block">{t("admin.reports.by", { name: fullName(a.creator.first_name, a.creator.last_name) })}</span> : null}
                </Td>
                <Td align="right">
                  {canManage ? (
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon-sm" aria-label={t("common.actions.edit")} onClick={() => { setErrors({}); setForm({ isNew: false, profileId: a.profile_id, role: a.role, permissions: a.permissions, is_active: a.is_active }); }}>
                        <Pencil className="size-4" />
                      </Button>
                      {a.profile_id !== selfId ? (
                        <Button variant="ghost" size="icon-sm" aria-label={a.is_active ? t("admin.admins.deactivate") : t("admin.admins.activate")} className={a.is_active ? "text-destructive" : "text-success"} onClick={() => setToggle({ id: a.profile_id, name: fullName(a.profile?.first_name, a.profile?.last_name), active: !a.is_active })}>
                          {a.is_active ? <UserMinus className="size-4" /> : <UserCheck className="size-4" />}
                        </Button>
                      ) : null}
                    </div>
                  ) : null}
                </Td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      )}

      {form ? (
        <RefFormSheet open onOpenChange={(o) => !o && setForm(null)} title={form.isNew ? t("admin.admins.add") : t("admin.admins.edit")} pending={pending} onSubmit={submit}>
          <Field label={t("admin.admins.profile_id")} htmlFor="ad-pid" required error={errors.profileId} description={t("admin.admins.profile_id_hint")}>
            <Input id="ad-pid" value={form.profileId} onChange={(e) => setForm({ ...form, profileId: e.target.value.trim() })} disabled={!form.isNew} invalid={!!errors.profileId} className="font-mono text-sm" placeholder="00000000-0000-0000-0000-000000000000" />
          </Field>
          <Field label={t("admin.admins.col_role")} htmlFor="ad-role">
            <Select id="ad-role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as AdminRole })} options={ADMIN_ROLE_VALUES.map((r) => ({ value: r, label: tEnum("admin_role", r) }))} />
          </Field>
          <Field label={t("admin.admins.col_permissions")} description={t("admin.admins.permissions_hint")}>
            <div className="grid grid-cols-1 gap-0.5 sm:grid-cols-2">
              {PERMISSIONS.map((p) => {
                const byRole = form.role === "super_admin" || rolePerms.includes(p);
                return (
                  <Checkbox
                    key={p}
                    checked={byRole || form.permissions.includes(p)}
                    disabled={byRole}
                    onCheckedChange={(c) => setForm({ ...form, permissions: c === true ? [...form.permissions, p] : form.permissions.filter((x) => x !== p) })}
                    label={<code className="text-xs">{p}</code>}
                  />
                );
              })}
            </div>
          </Field>
          {!form.isNew ? (
            <Field label={t("admin.ref.is_active")}>
              <Checkbox checked={form.is_active} onCheckedChange={(c) => setForm({ ...form, is_active: c === true })} label={t("admin.ref.active")} disabled={form.profileId === selfId} />
            </Field>
          ) : null}
        </RefFormSheet>
      ) : null}

      <ConfirmDialog
        open={!!toggle}
        onOpenChange={(o) => !o && setToggle(null)}
        title={toggle?.active ? t("admin.admins.activate_title", { name: toggle.name }) : t("admin.admins.deactivate_title", { name: toggle?.name ?? "" })}
        confirmLabel={toggle?.active ? t("admin.admins.activate") : t("admin.admins.deactivate")}
        cancelLabel={t("common.actions.cancel")}
        destructive={!toggle?.active}
        loading={pending}
        onConfirm={() => {
          if (toggle) run(() => setAdminActive({ profileId: toggle.id, active: toggle.active }), { success: t("admin.common.saved"), onOk: () => setToggle(null) });
        }}
      />
    </div>
  );
}
