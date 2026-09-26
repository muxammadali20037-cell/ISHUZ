"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n/client";
import { formatDate, fullName, initials } from "@/lib/format";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { revokeContactGrant } from "../../actions";
import type { ContactGrantRow } from "../../queries";
import { useAction } from "../use-action";

export function ContactGrantsList({ grants }: { grants: ContactGrantRow[] }) {
  const { t, locale } = useT();
  const { pending, run } = useAction();
  const [busyId, setBusyId] = useState<string | null>(null);

  if (grants.length === 0) return <p className="text-sm text-muted-foreground">{t("profile.settings.contact_grants_empty")}</p>;

  return (
    <ul className="divide-y divide-border">
      {grants.map((g) => {
        const p = g.grantee;
        const label = p ? fullName(p.first_name, p.last_name) : "";
        return (
          <li key={g.grantee_profile_id} className="flex items-center gap-3 py-2.5">
            <Avatar src={p?.avatar_url} fallback={p ? initials(p.first_name, p.last_name) : "?"} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{label || t("profile.rating.anonymous")}</p>
              <p className="text-xs text-muted-foreground">{t("profile.settings.granted_at", { date: formatDate(g.created_at, locale) })}</p>
            </div>
            <Button
              type="button"
              variant="destructive-soft"
              size="sm"
              loading={pending && busyId === g.grantee_profile_id}
              disabled={pending}
              onClick={() => {
                setBusyId(g.grantee_profile_id);
                run(() => revokeContactGrant({ grantee_profile_id: g.grantee_profile_id }), { success: t("profile.toast.deleted") });
              }}
            >
              {t("profile.settings.revoke")}
            </Button>
          </li>
        );
      })}
    </ul>
  );
}
