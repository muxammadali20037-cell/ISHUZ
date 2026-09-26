import { ShieldAlert } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { Button } from "@/components/ui/button";
import { signOut } from "@/features/auth/actions";

export default async function BlockedPage() {
  const { t } = await getT();
  return (
    <div className="container-narrow flex min-h-dvh flex-col items-center justify-center py-10 text-center">
      <div className="mb-4 flex size-16 items-center justify-center rounded-2xl bg-destructive-soft text-destructive">
        <ShieldAlert className="size-8" />
      </div>
      <h1 className="text-xl font-bold">{t("auth.blocked_title")}</h1>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">{t("auth.blocked_desc")}</p>
      <form action={signOut} className="mt-6">
        <Button variant="outline">{t("auth.logout")}</Button>
      </form>
    </div>
  );
}
