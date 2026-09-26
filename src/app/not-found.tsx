import Link from "next/link";
import { SearchX } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { Button } from "@/components/ui/button";

export default async function NotFound() {
  const { t } = await getT();
  return (
    <div className="container-narrow flex min-h-dvh flex-col items-center justify-center py-10 text-center">
      <div className="mb-4 flex size-16 items-center justify-center rounded-2xl bg-primary-soft text-primary">
        <SearchX className="size-8" />
      </div>
      <h1 className="text-xl font-bold">{t("common.errors.not_found")}</h1>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">{t("common.errors.not_found_desc")}</p>
      <Button asChild className="mt-6">
        <Link href="/">{t("common.nav.home")}</Link>
      </Button>
    </div>
  );
}
