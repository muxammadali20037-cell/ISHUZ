"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n/client";
import { formatRelative } from "@/lib/format";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { respondContactRequest } from "./actions";
import type { IncomingContactRequest } from "./queries";

/** Sozlamalar: kim telefon raqamimni so'radi — ruxsat berish / rad etish */
export function IncomingContactRequests({ items }: { items: IncomingContactRequest[] }) {
  const { t, locale } = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);

  if (!items.length) return <p className="text-sm text-muted-foreground">{t("contacts.incoming.empty")}</p>;

  const respond = (id: string, approve: boolean) => {
    setBusy(id);
    startTransition(async () => {
      const res = await respondContactRequest({ id, approve });
      if (!res.ok) toast.error(t("common.errors.generic"));
      else toast.success(approve ? t("contacts.incoming.approved") : t("contacts.incoming.declined"));
      router.refresh();
    });
  };

  return (
    <ul className="divide-y divide-border">
      {items.map((r) => (
        <li key={r.id} className="py-3">
          <div className="flex items-center gap-3">
            <Avatar src={r.avatarUrl} fallback={(r.name || "?").slice(0, 2)} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{r.name || "—"}</p>
              <p className="truncate text-xs text-muted-foreground">{[r.person && r.person !== r.name ? r.person : null, formatRelative(r.createdAt, locale)].filter(Boolean).join(" · ")}</p>
            </div>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Button type="button" size="sm" onClick={() => respond(r.id, true)} loading={pending && busy === r.id} disabled={pending}>
              {t("contacts.incoming.approve")}
            </Button>
            <Button type="button" size="sm" variant="secondary" onClick={() => respond(r.id, false)} disabled={pending}>
              {t("contacts.incoming.decline")}
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
