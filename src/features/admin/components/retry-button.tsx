"use client";

import { RotateCcw } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";
import { retryQueue } from "../actions/panel";
import { useAdminAction } from "./use-admin-action";

export function RetryQueueButton({ kind, disabled }: { kind: "match_jobs" | "telegram" | "moderation"; disabled?: boolean }) {
  const { t } = useT();
  const { pending, run } = useAdminAction();
  return (
    <Button type="button" size="sm" variant="outline" loading={pending} disabled={disabled} onClick={() => run(() => retryQueue({ kind }), { success: t("admin.queues.retried") })}>
      <RotateCcw className="size-4" /> {t("admin.queues.retry")}
    </Button>
  );
}
