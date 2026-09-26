"use client";

import { useState, useTransition } from "react";
import { Lock, LogOut, Mail, Phone } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { formatPhone } from "@/lib/format";
import { signOut } from "@/features/auth/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";

export function AccountCard({ phone, phoneVerified, email }: { phone: string | null; phoneVerified: boolean; email: string | null }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-4">
      <dl className="space-y-3 text-sm">
        <div className="flex items-center gap-3">
          <Phone className="size-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <dt className="text-xs text-muted-foreground">{t("profile.settings.phone")}</dt>
            <dd className="flex flex-wrap items-center gap-2 font-medium tabular">
              {phone ? formatPhone(phone) : t("common.labels.not_specified")}
              {phone ? <Badge variant={phoneVerified ? "success" : "warning"} size="sm">{phoneVerified ? t("profile.settings.phone_verified") : t("profile.settings.phone_not_verified")}</Badge> : null}
              <span className="inline-flex items-center gap-1 text-xs font-normal text-muted-foreground">
                <Lock className="size-3" /> {t("profile.settings.phone_locked_hint")}
              </span>
            </dd>
          </div>
        </div>
        {email ? (
          <div className="flex items-center gap-3">
            <Mail className="size-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <dt className="text-xs text-muted-foreground">{t("profile.settings.email")}</dt>
              <dd className="truncate font-medium">{email}</dd>
            </div>
          </div>
        ) : null}
      </dl>
      <Button type="button" variant="destructive-soft" onClick={() => setOpen(true)}>
        <LogOut className="size-4" /> {t("profile.settings.logout")}
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={t("profile.settings.logout_confirm_title")}
        description={t("profile.settings.logout_confirm_desc")}
        confirmLabel={t("profile.settings.logout")}
        cancelLabel={t("common.actions.cancel")}
        destructive
        loading={pending}
        onConfirm={() => startTransition(() => signOut())}
      />
    </div>
  );
}
