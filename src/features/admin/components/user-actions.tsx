"use client";

import { Ban, ShieldCheck } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { setUserBlock } from "../actions/users";
import { NoteActionButton } from "./note-dialog";

/** Bloklash / blokdan chiqarish tugmasi (users.block) → rpc admin_set_user_block */
export function UserBlockButton({ profileId, isBlocked, name, canBlock, size = "sm", fullWidth }: { profileId: string; isBlocked: boolean; name: string; canBlock: boolean; size?: "sm" | "default"; fullWidth?: boolean }) {
  const { t } = useT();
  if (!canBlock) return null;
  return isBlocked ? (
    <NoteActionButton
      label={t("common.actions.unblock")}
      icon={<ShieldCheck className="size-4" />}
      title={t("admin.users.unblock_title", { name })}
      description={t("admin.users.unblock_desc")}
      confirmLabel={t("common.actions.unblock")}
      variant="outline"
      size={size}
      successMessage={t("admin.users.unblocked")}
      action={() => setUserBlock({ profileId, block: false })}
      className={fullWidth ? "w-full" : undefined}
    />
  ) : (
    <NoteActionButton
      label={t("common.actions.block")}
      icon={<Ban className="size-4" />}
      title={t("admin.users.block_title", { name })}
      description={t("admin.users.block_desc")}
      confirmLabel={t("common.actions.block")}
      noteLabel={t("admin.users.block_reason")}
      noteRequired
      destructive
      variant="destructive-soft"
      size={size}
      successMessage={t("admin.users.blocked")}
      action={(note) => setUserBlock({ profileId, block: true, reason: note })}
      className={fullWidth ? "w-full" : undefined}
    />
  );
}
