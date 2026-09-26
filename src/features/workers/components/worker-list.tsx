"use client";

import { useState, useTransition } from "react";
import { useT } from "@/lib/i18n/client";
import { WorkerCard, type WorkerCardData } from "@/components/shared/worker-card";
import { toast } from "@/components/ui/toast";
import { toggleSaveWorker } from "../actions";
import { errorText } from "./error-text";

/** Nomzod kartalari ro'yxati: saqlash tugmasi optimistik ishlaydi, xato bo'lsa qaytariladi */
export function WorkerList({ rows, vacancyId, hideMatch }: { rows: WorkerCardData[]; vacancyId?: string | null; hideMatch?: boolean }) {
  const { t } = useT();
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const toggle = (id: string, next: boolean) => {
    setOverrides((o) => ({ ...o, [id]: next }));
    setBusy(id);
    startTransition(async () => {
      const res = await toggleSaveWorker({ workerId: id, save: next });
      setBusy(null);
      if (!res.ok) {
        setOverrides((o) => ({ ...o, [id]: !next }));
        toast.error(errorText(t, res.error));
        return;
      }
      toast.success(next ? t("workers.list.save_toast") : t("workers.list.unsave_toast"));
    });
  };

  return (
    <ul className="space-y-3">
      {rows.map((w) => {
        const isSaved = overrides[w.id] ?? w.is_saved;
        return (
          <li key={w.id}>
            <WorkerCard
              worker={{ ...w, is_saved: isSaved }}
              onToggleSave={toggle}
              saving={busy === w.id}
              hideMatch={hideMatch}
              href={vacancyId ? `/workers/${w.id}?vacancy=${vacancyId}` : `/workers/${w.id}`}
            />
          </li>
        );
      })}
    </ul>
  );
}
