"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Link2, Trash2, UserMinus, UserPlus } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { publicEnv } from "@/lib/env";
import { formatDate, fullName, initials } from "@/lib/format";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Select } from "@/components/ui/select";
import { Field } from "@/components/ui/label";
import { toast } from "@/components/ui/toast";
import { createCompanyInvite, deleteCompanyInvite, removeMember, setMemberRole } from "../../actions";
import { errorMessageKey } from "../../mappers";
import { ASSIGNABLE_MEMBER_ROLES, inviteLink } from "../../schema";
import type { CompanyInviteRow, CompanyMemberRole, MemberRow } from "../../types";

type AssignableRole = (typeof ASSIGNABLE_MEMBER_ROLES)[number];

function CopyLinkButton({ value }: { value: string }) {
  const { t } = useT();
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          toast.success(t("common.actions.copied"));
          setTimeout(() => setCopied(false), 1500);
        } catch {
          toast.error(t("common.errors.generic"));
        }
      }}
    >
      {copied ? <Check className="size-4 text-success" /> : <Copy className="size-4" />} {t("employer.members.copy_link")}
    </Button>
  );
}

/** A'zolar: ro'yxat, rol o'zgartirish, chiqarish; takliflar (havola) — faqat adminlar */
export function MembersTab({ companyId, userId, myRole, members, invites }: { companyId: string; userId: string; myRole: CompanyMemberRole | null; members: MemberRow[]; invites: CompanyInviteRow[] }) {
  const { t, tEnum, locale } = useT();
  const router = useRouter();
  const isAdmin = myRole === "owner" || myRole === "admin";
  const [pending, startTransition] = useTransition();
  const [removeTarget, setRemoveTarget] = useState<MemberRow | null>(null);
  const [inviteRole, setInviteRole] = useState<AssignableRole>("recruiter");
  const [createdLink, setCreatedLink] = useState<string | null>(null);
  const roleOptions = ASSIGNABLE_MEMBER_ROLES.map((r) => ({ value: r, label: tEnum("company_member_role", r) }));
  const fail = (code: string) => toast.error(t(errorMessageKey(code)));

  const changeRole = (m: MemberRow, role: AssignableRole) => {
    startTransition(async () => {
      const res = await setMemberRole({ companyId, profileId: m.profile_id, role });
      if (!res.ok) {
        fail(res.error);
        return;
      }
      toast.success(t("employer.members.role_updated"));
      router.refresh();
    });
  };

  const confirmRemove = async () => {
    if (!removeTarget) return;
    const res = await removeMember({ companyId, profileId: removeTarget.profile_id });
    setRemoveTarget(null);
    if (!res.ok) {
      fail(res.error);
      return;
    }
    toast.success(t("employer.members.removed"));
    router.refresh();
  };

  const createInvite = () => {
    startTransition(async () => {
      const res = await createCompanyInvite({ companyId, role: inviteRole });
      if (!res.ok || !res.data) {
        fail(res.ok ? "generic" : res.error);
        return;
      }
      setCreatedLink(res.data.link);
      toast.success(t("employer.members.invite_created"));
      router.refresh();
    });
  };

  const deleteInvite = (inviteId: string) => {
    startTransition(async () => {
      const res = await deleteCompanyInvite({ companyId, inviteId });
      if (!res.ok) {
        fail(res.error);
        return;
      }
      setCreatedLink(null);
      toast.success(t("employer.members.invite_deleted"));
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border/70 bg-card shadow-sm">
        <div className="flex items-center justify-between gap-2 p-4 sm:p-5">
          <h2 className="text-lg font-bold">{t("employer.members.title")}</h2>
          <span className="text-sm text-muted-foreground">{t("employer.members.count", { count: members.length })}</span>
        </div>
        <ul className="divide-y divide-border border-t border-border">
          {members.map((m) => {
            const isMe = m.profile_id === userId;
            const name = fullName(m.first_name, m.last_name) || t("employer.dashboard.unknown_candidate");
            const editable = isAdmin && m.role !== "owner" && !isMe;
            return (
              <li key={m.profile_id} className="flex flex-wrap items-center gap-3 p-4 sm:px-5">
                <Avatar src={m.avatar_url} fallback={initials(m.first_name, m.last_name)} size="md" alt="" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">
                    {name} {isMe ? <span className="text-xs font-normal text-muted-foreground">({t("employer.members.you")})</span> : null}
                  </p>
                  <p className="text-xs text-muted-foreground">{formatDate(m.created_at, locale)}</p>
                </div>
                {editable ? (
                  <div className="flex w-full items-center gap-2 sm:w-auto">
                    <div className="w-40">
                      <Select aria-label={t("employer.members.change_role")} options={roleOptions} value={m.role} disabled={pending} onChange={(e) => changeRole(m, e.target.value as AssignableRole)} className="h-10 text-sm" />
                    </div>
                    <Button type="button" variant="ghost" size="icon-sm" aria-label={t("employer.members.remove")} disabled={pending} onClick={() => setRemoveTarget(m)}>
                      <UserMinus className="size-4 text-destructive" />
                    </Button>
                  </div>
                ) : (
                  <Badge variant={m.role === "owner" ? "primary" : "default"}>{tEnum("company_member_role", m.role)}</Badge>
                )}
              </li>
            );
          })}
        </ul>
        <p className="border-t border-border px-4 py-3 text-xs text-muted-foreground sm:px-5">{t("employer.members.roles_help")}</p>
      </section>

      <section className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:p-5">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <UserPlus className="size-5 text-primary" /> {t("employer.members.invite_title")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{isAdmin ? t("employer.members.invite_desc") : t("employer.members.admin_only")}</p>
        {isAdmin ? (
          <>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
              <Field label={t("employer.members.invite_role")} htmlFor="invite-role" className="sm:w-56">
                <Select id="invite-role" options={roleOptions} value={inviteRole} onChange={(e) => setInviteRole(e.target.value as AssignableRole)} disabled={pending} />
              </Field>
              <Button onClick={createInvite} loading={pending} className="sm:mb-0">
                <Link2 className="size-4" /> {t("employer.members.create_invite")}
              </Button>
            </div>
            {createdLink ? (
              <div className="mt-4 rounded-xl bg-primary-soft/60 p-3">
                <p className="mb-2 text-xs font-medium text-primary">{t("employer.members.invite_link")}</p>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <code className="min-w-0 flex-1 truncate rounded-lg bg-card px-3 py-2 text-xs">{createdLink}</code>
                  <CopyLinkButton value={createdLink} />
                </div>
              </div>
            ) : null}
            <h3 className="mt-6 text-sm font-semibold">{t("employer.members.pending_invites")}</h3>
            {invites.length ? (
              <ul className="mt-2 divide-y divide-border rounded-xl border border-border">
                {invites.map((inv) => {
                  const link = inviteLink(publicEnv.NEXT_PUBLIC_APP_URL, inv.token);
                  return (
                    <li key={inv.id} className="flex flex-wrap items-center gap-2 px-3 py-2.5">
                      <Badge variant="outline">{tEnum("company_member_role", inv.role)}</Badge>
                      <span className="text-xs text-muted-foreground">{t("employer.members.expires", { date: formatDate(inv.expires_at, locale) })}</span>
                      <div className="ml-auto flex items-center gap-1">
                        <CopyLinkButton value={link} />
                        <Button type="button" variant="ghost" size="icon-sm" aria-label={t("employer.members.delete_invite")} disabled={pending} onClick={() => deleteInvite(inv.id)}>
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">{t("employer.members.no_invites")}</p>
            )}
          </>
        ) : null}
      </section>

      <ConfirmDialog
        open={!!removeTarget}
        onOpenChange={(o) => !o && setRemoveTarget(null)}
        title={t("employer.members.remove_confirm_title")}
        description={t("employer.members.remove_confirm_desc", { name: removeTarget ? fullName(removeTarget.first_name, removeTarget.last_name) : "" })}
        confirmLabel={t("employer.members.remove")}
        cancelLabel={t("common.actions.cancel")}
        onConfirm={confirmRemove}
        destructive
      />
    </div>
  );
}
