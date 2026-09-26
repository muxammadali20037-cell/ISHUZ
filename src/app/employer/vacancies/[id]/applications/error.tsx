"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { EmptyState } from "@/components/ui/misc";

export default function PipelineError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useT();
  useEffect(() => {
    console.error("[employer/applications]", error);
  }, [error]);
  return (
    <div className="container-narrow py-10">
      <EmptyState icon={AlertTriangle} title={t("common.errors.generic")} description={t("common.errors.try_again")} action={{ label: t("common.actions.retry"), onClick: reset }} />
    </div>
  );
}
