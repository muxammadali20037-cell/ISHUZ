"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n/client";
import { Switch } from "@/components/ui/checkbox";
import { updateVisibility } from "../../actions";
import { useAction } from "../use-action";
import { EditSectionCard } from "./section-card";

/** is_public: darhol saqlanadi */
export function VisibilityForm({ isPublic }: { isPublic: boolean }) {
  const { t } = useT();
  const { pending, run } = useAction();
  const [value, setValue] = useState(isPublic);

  const toggle = (next: boolean) => {
    const prev = value;
    setValue(next);
    run(() => updateVisibility({ is_public: next }), { onError: () => setValue(prev) });
  };

  return (
    <EditSectionCard id="visibility" title={t("profile.sections.visibility")}>
      <label className="flex cursor-pointer items-start justify-between gap-4">
        <span className="flex-1">
          <span className="block text-[15px] font-medium">{t("profile.labels.is_public")}</span>
          <span className="mt-0.5 block text-xs text-muted-foreground">{t("profile.labels.is_public_hint")}</span>
        </span>
        <Switch checked={value} onCheckedChange={toggle} disabled={pending} aria-label={t("profile.labels.is_public")} />
      </label>
    </EditSectionCard>
  );
}
