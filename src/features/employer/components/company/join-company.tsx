"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, LinkIcon } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { toast } from "@/components/ui/toast";
import { acceptCompanyInvite } from "../../actions";
import { errorMessageKey } from "../../mappers";

/** /company/join?token=... — taklifni qabul qilish (rpc accept_company_invite) */
export function JoinCompany({ token }: { token: string | null }) {
  const { t } = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [invalid, setInvalid] = useState(!token);

  if (invalid) {
    return (
      <EmptyState
        icon={LinkIcon}
        title={t("employer.join.invalid_title")}
        description={token ? t("employer.join.invalid_desc") : t("employer.join.missing_token")}
        action={{ label: t("employer.join.go_home"), href: "/" }}
      />
    );
  }

  const accept = () => {
    if (!token) return;
    startTransition(async () => {
      const res = await acceptCompanyInvite({ token });
      if (!res.ok) {
        if (res.error === "invite_invalid") {
          setInvalid(true);
          return;
        }
        toast.error(t(errorMessageKey(res.error)));
        return;
      }
      toast.success(t("employer.join.success"));
      router.replace("/employer");
      router.refresh();
    });
  };

  return (
    <div className="rounded-3xl border border-border/70 bg-card p-6 text-center shadow-sm sm:p-8">
      <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary-soft text-primary">
        <Building2 className="size-7" />
      </div>
      <h1 className="mt-4 text-xl font-bold sm:text-2xl">{t("employer.join.title")}</h1>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{t("employer.join.desc")}</p>
      <div className="mt-6 flex flex-col-reverse justify-center gap-2 sm:flex-row">
        <Button asChild variant="ghost" size="lg">
          <Link href="/">{t("common.actions.cancel")}</Link>
        </Button>
        <Button size="lg" onClick={accept} loading={pending}>
          {t("employer.join.accept")}
        </Button>
      </div>
    </div>
  );
}
