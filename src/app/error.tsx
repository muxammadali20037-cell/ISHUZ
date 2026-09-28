"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";

/** Umumiy xato sahifasi: texnik xabar ko'rsatilmaydi, keyingi qadam taklif qilinadi */
export default function AppError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const { t } = useT();
  useEffect(() => {
    console.error("[app] error", error.digest ?? "", error.message);
  }, [error]);
  return (
    <div className="container-narrow flex min-h-[60vh] flex-col items-center justify-center py-10 text-center">
      <div className="mb-4 flex size-16 items-center justify-center rounded-2xl bg-warning-soft text-warning">
        <AlertTriangle className="size-8" />
      </div>
      <h1 className="text-xl font-bold">{t("common.error_page.title")}</h1>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">{t("common.error_page.desc")}</p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Button onClick={() => retry()}>{t("common.actions.retry")}</Button>
        <Button asChild variant="outline">
          <Link href="/">{t("common.error_page.home")}</Link>
        </Button>
      </div>
      {error.digest ? <p className="mt-6 text-xs text-muted-foreground">{t("common.error_page.code", { code: error.digest })}</p> : null}
    </div>
  );
}
