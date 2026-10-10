"use client";

import { LogOut, ShieldOff, ToggleLeft, ToggleRight } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { liftRestriction, revokeUserSessions, setSecurityEnforce } from "../actions/security";
import { NoteActionButton } from "./note-dialog";

/** Faol cheklovni olib tashlash (security.manage) */
export function LiftRestrictionButton({ id }: { id: number }) {
  const { t } = useT();
  return (
    <NoteActionButton
      label={t("admin.security.lift")}
      icon={<ShieldOff className="size-4" />}
      title={t("admin.security.lift_title")}
      description={t("admin.security.lift_desc")}
      confirmLabel={t("admin.security.lift")}
      successMessage={t("admin.common.done")}
      action={() => liftRestriction({ id })}
    />
  );
}

/** Kuzatuv ↔ majburiy rejim */
export function EnforceToggle({ enforce }: { enforce: boolean }) {
  const { t } = useT();
  return (
    <NoteActionButton
      label={enforce ? t("admin.security.switch_observe") : t("admin.security.switch_enforce")}
      icon={enforce ? <ToggleRight className="size-4" /> : <ToggleLeft className="size-4" />}
      title={enforce ? t("admin.security.switch_observe") : t("admin.security.switch_enforce")}
      description={enforce ? t("admin.security.observe_desc") : t("admin.security.enforce_desc")}
      confirmLabel={t("common.actions.confirm")}
      destructive={!enforce}
      successMessage={t("admin.common.done")}
      action={() => setSecurityEnforce({ enforce: !enforce })}
    />
  );
}

/** Foydalanuvchini bloklamasdan barcha qurilmalardan chiqarish (users.block) */
export function RevokeSessionsButton({ profileId, name, canBlock, size = "sm", fullWidth }: { profileId: string; name: string; canBlock: boolean; size?: "sm" | "default"; fullWidth?: boolean }) {
  const { t } = useT();
  if (!canBlock) return null;
  return (
    <NoteActionButton
      label={t("admin.security.revoke_sessions")}
      icon={<LogOut className="size-4" />}
      title={t("admin.security.revoke_title", { name })}
      description={t("admin.security.revoke_desc")}
      confirmLabel={t("admin.security.revoke_sessions")}
      size={size}
      successMessage={t("admin.common.done")}
      action={() => revokeUserSessions({ profileId })}
      className={fullWidth ? "w-full" : undefined}
    />
  );
}
