"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n/client";
import { ChipGroup } from "@/components/ui/chip";
import { Constants, type Enums } from "@/types/database.types";
import { updateWorkerStatus } from "../actions";
import { useAction } from "./use-action";

type WorkerStatus = Enums<"worker_status">;

/** Ish qidirish holati: active / open / not_looking (bitta tanlov, darhol saqlanadi) */
export function StatusSelector({ value }: { value: WorkerStatus }) {
  const { t, tEnum } = useT();
  const [status, setStatus] = useState<WorkerStatus>(value);
  const { pending, run } = useAction();

  const change = (next: WorkerStatus | WorkerStatus[] | null) => {
    if (!next || Array.isArray(next) || next === status) return;
    const prev = status;
    setStatus(next);
    run(() => updateWorkerStatus({ status: next }), {
      success: t("profile.toast.status_saved"),
      onError: () => setStatus(prev),
    });
  };

  return (
    <div className={pending ? "opacity-70" : undefined}>
      <p className="mb-2 text-sm font-semibold">{t("profile.view.status_title")}</p>
      <ChipGroup
        size="sm"
        options={Constants.public.Enums.worker_status.map((s) => ({ value: s, label: tEnum("worker_status_short", s) }))}
        value={status}
        onChange={change}
      />
      <p className="mt-2 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{tEnum("worker_status", status)}.</span> {t(`profile.view.status_hint.${status}`)}
      </p>
    </div>
  );
}
