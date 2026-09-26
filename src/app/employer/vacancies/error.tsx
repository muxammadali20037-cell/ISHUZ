"use client";

import { useEffect } from "react";
import { AlertCircle } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { EmptyState } from "@/components/ui/misc";

export default function VacanciesError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useT();
  useEffect(() => {
    console.error("[vacancies]", error);
  }, [error]);
  return (
    <div className="container-narrow py-10">
      <EmptyState icon={AlertCircle} title={t("vacancies.errors.load_failed")} description={t("common.errors.generic")} action={{ label: t("common.actions.retry"), onClick: reset }} />
    </div>
  );
}
