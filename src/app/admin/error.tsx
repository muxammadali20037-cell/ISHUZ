"use client";

import { AlertTriangle } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useT();
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border px-6 py-16 text-center">
      <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-destructive-soft text-destructive">
        <AlertTriangle className="size-7" />
      </div>
      <h2 className="text-base font-semibold">{t("common.errors.generic")}</h2>
      {error.digest ? <p className="mt-1 text-xs text-muted-foreground">{error.digest}</p> : null}
      <Button className="mt-5" onClick={reset}>
        {t("common.actions.retry")}
      </Button>
    </div>
  );
}
