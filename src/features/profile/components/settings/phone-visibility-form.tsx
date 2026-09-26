"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n/client";
import { RadioGroup, RadioItem } from "@/components/ui/checkbox";
import { Constants, type Enums } from "@/types/database.types";
import { updatePhoneVisibility } from "../../actions";
import { useAction } from "../use-action";

type Visibility = Enums<"phone_visibility">;

/** Telefonni kim ko'radi: tanlanishi bilan saqlanadi */
export function PhoneVisibilityForm({ value }: { value: Visibility }) {
  const { t, tEnum } = useT();
  const { pending, run } = useAction();
  const [current, setCurrent] = useState<Visibility>(value);

  const change = (next: string) => {
    const v = next as Visibility;
    if (v === current) return;
    const prev = current;
    setCurrent(v);
    run(() => updatePhoneVisibility({ phone_visibility: v }), { onError: () => setCurrent(prev) });
  };

  return (
    <RadioGroup value={current} onValueChange={change} disabled={pending} className={pending ? "space-y-2 opacity-70" : "space-y-2"}>
      {Constants.public.Enums.phone_visibility.map((v) => (
        <RadioItem key={v} value={v} label={tEnum("phone_visibility", v)} description={t(`profile.settings.phone_visibility_desc.${v}`)} />
      ))}
    </RadioGroup>
  );
}
