"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { EmptyState } from "@/components/ui/misc";

export default function JobsError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useT();
  useEffect(() => {
    console.error("[jobs] page error", error);
  }, [error]);
  return (
    <EmptyState
      className="mt-4"
      icon={AlertTriangle}
      title={t("jobs.error.title")}
      description={t("jobs.error.description")}
      action={{ label: t("common.actions.retry"), onClick: reset }}
    />
  );
}
