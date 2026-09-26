"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import type { Language } from "@/lib/reference";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import { Constants, type Enums } from "@/types/database.types";
import { updateLanguages } from "../../actions";
import { MAX_LANGUAGES } from "../../schema";
import { useAction } from "../use-action";
import { EditSectionCard } from "./section-card";

type Row = { code: string; level: Enums<"language_level"> };

export function LanguagesForm({ initial, languages }: { initial: Row[]; languages: Language[] }) {
  const { t, tEnum, name } = useT();
  const { pending, run } = useAction();
  const [rows, setRows] = useState<Row[]>(initial);
  const [adding, setAdding] = useState("");
  const used = new Set(rows.map((r) => r.code));
  const available = languages.filter((l) => !used.has(l.code));
  const levelOptions = Constants.public.Enums.language_level.map((l) => ({ value: l, label: tEnum("language_level", l) }));

  const add = (code: string) => {
    if (!code) return;
    if (rows.length >= MAX_LANGUAGES) {
      toast.error(t("profile.errors.max_languages", { max: MAX_LANGUAGES }));
      return;
    }
    setRows([...rows, { code, level: code === "uz" ? "native" : "b1" }]);
    setAdding("");
  };

  return (
    <EditSectionCard
      id="languages"
      title={t("profile.sections.languages")}
      footer={
        <Button type="button" loading={pending} onClick={() => run(() => updateLanguages({ languages: rows }))}>
          {t("common.actions.save")}
        </Button>
      }
    >
      {rows.length === 0 ? <p className="text-sm text-muted-foreground">{t("profile.empty.languages")}</p> : null}
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.code} className="flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate text-sm font-medium">{name(languages.find((l) => l.code === r.code)) || r.code}</span>
            <Select
              aria-label={t("profile.labels.level")}
              options={levelOptions}
              value={r.level}
              onChange={(e) => setRows(rows.map((x) => (x.code === r.code ? { ...x, level: e.target.value as Enums<"language_level"> } : x)))}
              className="h-10 w-44 text-sm"
            />
            <Button type="button" variant="ghost" size="icon-sm" aria-label={t("common.actions.delete")} onClick={() => setRows(rows.filter((x) => x.code !== r.code))}>
              <X className="size-4" />
            </Button>
          </li>
        ))}
      </ul>
      {available.length ? (
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <Select aria-label={t("profile.labels.add_language")} placeholder={t("profile.labels.add_language")} options={available.map((l) => ({ value: l.code, label: name(l) }))} value={adding} onChange={(e) => setAdding(e.target.value)} />
          </div>
          <Button type="button" variant="soft" disabled={!adding} onClick={() => add(adding)} aria-label={t("common.actions.add")}>
            <Plus className="size-4" /> {t("common.actions.add")}
          </Button>
        </div>
      ) : null}
    </EditSectionCard>
  );
}
