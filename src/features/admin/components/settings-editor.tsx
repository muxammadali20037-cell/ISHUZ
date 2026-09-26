"use client";

import { useState } from "react";
import { Save } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import type { Json } from "@/types/database.types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Textarea } from "@/components/ui/input";
import { Switch, Checkbox } from "@/components/ui/checkbox";
import { formatDateTime } from "@/lib/format";
import { updateSetting } from "../actions/settings";
import type { SettingRow } from "../queries/settings";
import { TableWrap, Th, Td } from "./data-table";
import { useAdminAction } from "./use-admin-action";

type Kind = "boolean" | "number" | "string" | "json";

function kindOf(v: Json): Kind {
  if (typeof v === "boolean") return "boolean";
  if (typeof v === "number") return "number";
  if (typeof v === "string") return "string";
  return "json";
}

/** app_settings jadvali: tipga qarab muharrir (boolean/number/string/JSON), is_public, saqlash */
export function SettingsEditor({ settings, canManage }: { settings: SettingRow[]; canManage: boolean }) {
  const { t, locale } = useT();
  return (
    <TableWrap>
      <thead>
        <tr>
          <Th>{t("admin.settings.col_key")}</Th>
          <Th>{t("admin.settings.col_value")}</Th>
          <Th>{t("admin.settings.col_public")}</Th>
          <Th>{t("common.labels.updated")}</Th>
          <Th />
        </tr>
      </thead>
      <tbody>
        {settings.map((s) => (
          <SettingRowEditor key={s.key} setting={s} canManage={canManage} locale={locale} />
        ))}
      </tbody>
    </TableWrap>
  );
}

function SettingRowEditor({ setting, canManage, locale }: { setting: SettingRow; canManage: boolean; locale: "uz" | "ru" }) {
  const { t } = useT();
  const { pending, run } = useAdminAction();
  const kind = kindOf(setting.value);
  const [value, setValue] = useState<string>(kind === "json" ? JSON.stringify(setting.value, null, 2) : String(setting.value));
  const [isPublic, setIsPublic] = useState(setting.is_public);
  const [jsonError, setJsonError] = useState(false);
  const dirty = value !== (kind === "json" ? JSON.stringify(setting.value, null, 2) : String(setting.value)) || isPublic !== setting.is_public;

  const toJson = (): string | null => {
    if (kind === "boolean") return value === "true" ? "true" : "false";
    if (kind === "number") return Number.isFinite(Number(value)) && value.trim() !== "" ? String(Number(value)) : null;
    if (kind === "string") return JSON.stringify(value);
    try {
      return JSON.stringify(JSON.parse(value));
    } catch {
      return null;
    }
  };

  const save = () => {
    const valueJson = toJson();
    if (valueJson === null) {
      setJsonError(true);
      return;
    }
    setJsonError(false);
    run(() => updateSetting({ key: setting.key, valueJson, is_public: isPublic }), { success: t("admin.common.saved") });
  };

  const labelKey = `admin.settings.keys.${setting.key}`;
  const label = t(labelKey);

  return (
    <tr className="hover:bg-secondary/40">
      <Td>
        <code className="text-xs">{setting.key}</code>
        {label !== labelKey ? <p className="mt-0.5 max-w-[260px] text-xs text-muted-foreground">{label}</p> : null}
        <Badge size="sm" className="mt-1">{kind}</Badge>
      </Td>
      <Td className="min-w-[220px]">
        {kind === "boolean" ? (
          <Switch checked={value === "true"} onCheckedChange={(b) => setValue(String(b))} disabled={!canManage} aria-label={setting.key} />
        ) : kind === "number" ? (
          <Input type="number" value={value} onChange={(e) => setValue(e.target.value)} disabled={!canManage} invalid={jsonError} className="h-10 w-40 rounded-lg text-sm" />
        ) : kind === "string" ? (
          <Input value={value} onChange={(e) => setValue(e.target.value)} disabled={!canManage} className="h-10 rounded-lg text-sm" />
        ) : (
          <Textarea value={value} onChange={(e) => setValue(e.target.value)} disabled={!canManage} invalid={jsonError} className="min-h-[80px] font-mono text-xs" />
        )}
        {jsonError ? <p className="mt-1 text-xs text-destructive">{t("admin.errors.invalid_json")}</p> : null}
      </Td>
      <Td>
        <Checkbox checked={isPublic} onCheckedChange={(c) => setIsPublic(c === true)} disabled={!canManage} aria-label={t("admin.settings.col_public")} />
      </Td>
      <Td className="text-xs text-muted-foreground">{formatDateTime(setting.updated_at, locale)}</Td>
      <Td align="right">
        {canManage ? (
          <Button size="sm" variant={dirty ? "default" : "outline"} disabled={!dirty} loading={pending} onClick={save}>
            <Save className="size-4" /> {t("common.actions.save")}
          </Button>
        ) : (
          <span className="text-xs text-muted-foreground">{t("admin.settings.read_only")}</span>
        )}
      </Td>
    </tr>
  );
}
