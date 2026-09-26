import { AlertTriangle, ShieldOff } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { cn } from "@/lib/utils";

/** Ruxsat yo'q sahifa */
export async function Forbidden({ perm }: { perm?: string }) {
  const { t } = await getT();
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border px-6 py-16 text-center">
      <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-destructive-soft text-destructive">
        <ShieldOff className="size-7" />
      </div>
      <h2 className="text-base font-semibold">{t("admin.common.forbidden_title")}</h2>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{t("admin.common.forbidden_desc")}</p>
      {perm ? <code className="mt-3 rounded bg-secondary px-2 py-1 text-xs">{perm}</code> : null}
    </div>
  );
}

/** So'rov xatosi banneri (RLS/ulanish) */
export async function QueryError({ message }: { message: string | null }) {
  if (!message) return null;
  const { t } = await getT();
  return (
    <div className="mb-4 flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive-soft px-3 py-2.5 text-sm text-destructive" role="alert">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
      <div>
        <p className="font-medium">{t("admin.common.load_error")}</p>
        <p className="mt-0.5 break-all text-xs opacity-80">{message}</p>
      </div>
    </div>
  );
}

/** Sahifa sarlavhasi (admin) */
export function AdminPageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{title}</h1>
        {subtitle ? <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
