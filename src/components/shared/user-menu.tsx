"use client";

import { useTransition, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronsUpDown, LogOut, Settings, User, Briefcase, Repeat } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { setActiveRole, signOut } from "@/features/auth/actions";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { callAction } from "@/lib/action-call";

/** Admin panel bu menyuda yo'q: u alohida hostda (ADMIN_HOST) ochiladi */
export function UserMenu({
  name,
  roles,
  activeRole,
  avatar,
  variant = "default",
  subtitle,
}: {
  name: string;
  roles: string[];
  activeRole: string | null;
  avatar: ReactNode;
  /** "sidebar" — to'q ko'k yon menyu pastidagi foydalanuvchi kartasi (ism, rejim) */
  variant?: "default" | "sidebar";
  subtitle?: string;
}) {
  const { t } = useT();
  const router = useRouter();
  const [, startTransition] = useTransition();

  const switchRole = (role: "worker" | "employer") => {
    startTransition(async () => {
      await callAction(() => setActiveRole(role));
      router.push(role === "employer" ? "/employer" : "/");
      router.refresh();
    });
  };

  return (
    <DropdownMenu>
      {variant === "sidebar" ? (
        <DropdownMenuTrigger className="flex min-h-12 w-full items-center gap-3 rounded-md px-3 py-2 text-left hover:bg-navy-foreground/5" aria-label={name}>
          {avatar}
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sub font-medium text-navy-foreground">{name}</span>
            {subtitle ? <span className="block truncate text-xs text-navy-muted/70">{subtitle}</span> : null}
          </span>
          <ChevronsUpDown className="size-4 shrink-0 text-navy-muted/70" aria-hidden />
        </DropdownMenuTrigger>
      ) : (
        <DropdownMenuTrigger className="flex min-h-11 items-center gap-1 rounded-md p-1.5 hover:bg-secondary" aria-label={name}>
          {avatar}
          <ChevronDown className="hidden size-4 text-muted-foreground sm:block" />
        </DropdownMenuTrigger>
      )}
      <DropdownMenuContent align={variant === "sidebar" ? "start" : "end"} side={variant === "sidebar" ? "top" : undefined} className="w-56">
        <DropdownMenuLabel className="truncate text-sm font-semibold text-foreground">{name}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/profile">
            <User /> {t("common.nav.profile")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/settings">
            <Settings /> {t("common.nav.settings")}
          </Link>
        </DropdownMenuItem>
        {activeRole !== "employer" ? (
          <DropdownMenuItem onSelect={() => (roles.includes("employer") ? switchRole("employer") : router.push("/onboarding/employer"))}>
            <Briefcase /> {t("common.nav.switch_to_employer")}
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onSelect={() => (roles.includes("worker") ? switchRole("worker") : router.push("/onboarding/worker"))}>
            <Repeat /> {t("common.nav.switch_to_worker")}
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem destructive onSelect={() => startTransition(() => signOut())}>
          <LogOut /> {t("common.nav.logout")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
