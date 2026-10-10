"use client";

import { useState } from "react";
import { Save, SlidersHorizontal } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { updateSetting } from "../actions/settings";
import { useAdminAction } from "./use-admin-action";

export interface QuickControl {
  key: string;
  kind: "boolean" | "number";
  value: boolean | number;
  isPublic: boolean;
  label: string;
  hint: string;
  /** Holat matni: yoqilgan / o'chirilgan (masalan "Pullik" / "Bepul") */
  onText?: string;
  offText?: string;
  suffix?: string;
}

/**
 * Tezkor boshqaruv: eng ko'p kerak bo'ladigan sozlamalar oddiy tilda (AI PRO bepul/pullik, narx, ...).
 * Har o'zgarish app_settings ga yoziladi va auditga tushadi (updateSetting). Huquq bo'lmasa — faqat ko'rish.
 */
export function QuickControls({ items, canManage }: { items: QuickControl[]; canManage: boolean }) {
  const { t } = useT();
  return (
    <section className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:p-5" aria-labelledby="quick-controls-title">
      <div className="flex items-center gap-2">
        <SlidersHorizontal className="size-5 text-primary" aria-hidden />
        <h2 id="quick-controls-title" className="text-base font-semibold">
          {t("admin.quick.title")}
        </h2>
        {!canManage ? <Badge size="sm">{t("admin.settings.read_only")}</Badge> : null}
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{t("admin.quick.subtitle")}</p>
      <ul className="mt-4 divide-y divide-border/70">
        {items.map((it) => (
          <li key={it.key} className="py-3 first:pt-0 last:pb-0">
            <ControlRow item={it} canManage={canManage} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function ControlRow({ item, canManage }: { item: QuickControl; canManage: boolean }) {
  const { t } = useT();
  const { pending, run } = useAdminAction();
  const [num, setNum] = useState(String(item.value));
  const save = (valueJson: string) => run(() => updateSetting({ key: item.key, valueJson, is_public: item.isPublic }), { success: t("admin.common.saved") });

  if (item.kind === "boolean") {
    const on = item.value === true;
    return (
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-medium">{item.label}</p>
          <p className="text-sm text-muted-foreground">{item.hint}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-bold", on ? "bg-warning-soft text-warning" : "bg-success-soft text-success")}>
            {on ? (item.onText ?? t("admin.quick.on")) : (item.offText ?? t("admin.quick.off"))}
          </span>
          <Switch checked={on} disabled={!canManage || pending} onCheckedChange={(b) => save(b ? "true" : "false")} aria-label={item.label} />
        </div>
      </div>
    );
  }

  const valid = num.trim() !== "" && Number.isFinite(Number(num)) && Number(num) >= 0;
  const dirty = valid && Number(num) !== item.value;
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <p className="font-medium">{item.label}</p>
        <p className="text-sm text-muted-foreground">{item.hint}</p>
      </div>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          inputMode="numeric"
          min={0}
          value={num}
          onChange={(e) => setNum(e.target.value)}
          disabled={!canManage}
          invalid={!valid}
          aria-label={item.label}
          className="h-10 w-32 rounded-lg text-sm"
        />
        {item.suffix ? <span className="text-sm text-muted-foreground">{item.suffix}</span> : null}
        {canManage ? (
          <Button size="sm" variant={dirty ? "default" : "outline"} disabled={!dirty} loading={pending} onClick={() => save(String(Number(num)))}>
            <Save className="size-4" /> {t("common.actions.save")}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
