"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Briefcase, Check, Plus, UserRound } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { setActiveRole } from "@/features/auth/actions";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { actionErrorMessage } from "../../i18n-helpers";

type Role = "worker" | "employer";

export function RoleSwitch({ roles, activeRole }: { roles: string[]; activeRole: string | null }) {
  const { t } = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const has = (r: Role) => roles.includes(r);

  const switchTo = (role: Role) => {
    if (role === activeRole) return;
    startTransition(async () => {
      const res = await setActiveRole(role);
      if (!res.ok) {
        toast.error(actionErrorMessage(t, res.error));
        return;
      }
      router.push(role === "employer" ? "/employer" : "/");
      router.refresh();
    });
  };

  const items: { role: Role; icon: typeof Briefcase; label: string; addHref: string; addLabel: string }[] = [
    { role: "worker", icon: UserRound, label: t("common.role.worker"), addHref: "/onboarding/worker", addLabel: t("profile.settings.role_add_worker") },
    { role: "employer", icon: Briefcase, label: t("common.role.employer"), addHref: "/onboarding/employer", addLabel: t("profile.settings.role_add_employer") },
  ];

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {items.map(({ role, icon: Icon, label, addHref, addLabel }) => {
        if (!has(role)) {
          return (
            <Button key={role} asChild variant="outline" className="h-auto justify-start py-3">
              <Link href={addHref}>
                <Plus className="size-4" /> {addLabel}
              </Link>
            </Button>
          );
        }
        const active = activeRole === role;
        return (
          <button
            key={role}
            type="button"
            disabled={pending || active}
            onClick={() => switchTo(role)}
            aria-pressed={active}
            className={cn(
              "flex min-h-14 items-center gap-3 rounded-xl border p-3 text-left transition-colors disabled:cursor-default",
              active ? "border-primary bg-primary-soft/60" : "border-border bg-card hover:bg-secondary",
            )}
          >
            <span className={cn("flex size-9 items-center justify-center rounded-lg", active ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground")}>
              <Icon className="size-4.5" />
            </span>
            <span className="flex-1">
              <span className="block text-sm font-semibold">{label}</span>
              {active ? <span className="block text-xs text-primary">{t("profile.settings.role_current")}</span> : null}
            </span>
            {active ? <Check className="size-4 text-primary" strokeWidth={3} /> : null}
          </button>
        );
      })}
    </div>
  );
}
