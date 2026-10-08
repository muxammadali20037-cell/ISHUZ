"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { updateMatching } from "../actions/panel";
import { MATCH_WEIGHT_KEYS } from "../schema";
import { useAdminAction } from "./use-admin-action";

/** Og'irliklar (jami 100) va avtomatik Telegram chegarasi. Saqlash — yangi qoidalar versiyasi, audit. */
export function MatchingForm({ weights, threshold, canManage }: { weights: Record<string, number>; threshold: number; canManage: boolean }) {
  const { t } = useT();
  const { pending, run } = useAdminAction();
  const [w, setW] = useState<Record<string, number>>(weights);
  const [th, setTh] = useState(threshold);
  const sum = MATCH_WEIGHT_KEYS.reduce((a, k) => a + (Number.isFinite(w[k]) ? w[k]! : 0), 0);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        run(() => updateMatching({ weights: w, threshold: th }), { success: t("admin.matching.saved") });
      }}
      className="space-y-4"
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {MATCH_WEIGHT_KEYS.map((k) => (
          <label key={k} className="block rounded-xl border border-border bg-card p-3">
            <span className="mb-1 block text-sm font-medium">{t(`admin.matching.weights.${k}`)}</span>
            <Input type="number" min={0} max={60} value={w[k] ?? 0} disabled={!canManage} onChange={(e) => setW({ ...w, [k]: Math.round(Number(e.target.value) || 0) })} className="tabular" />
          </label>
        ))}
      </div>
      <p className={cn("text-sm font-semibold", sum === 100 ? "text-success" : "text-destructive")} aria-live="polite">
        {t("admin.matching.sum", { sum })}
      </p>
      <label className="block max-w-xs">
        <span className="mb-1 block text-sm font-medium">{t("admin.matching.threshold")}</span>
        <Input type="number" min={50} max={100} value={th} disabled={!canManage} onChange={(e) => setTh(Math.round(Number(e.target.value) || 0))} className="tabular" />
        <span className="mt-1 block text-xs text-muted-foreground">{t("admin.matching.threshold_hint")}</span>
      </label>
      {canManage ? (
        <Button type="submit" loading={pending} disabled={sum !== 100 || th < 50 || th > 100}>
          {t("admin.matching.save")}
        </Button>
      ) : null}
    </form>
  );
}
