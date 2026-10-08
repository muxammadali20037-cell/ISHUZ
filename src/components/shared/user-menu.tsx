"use client";

import { useTransition, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, LogOut, Settings, User, Briefcase, Repeat } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { setActiveRole, signOut } from "@/features/auth/actions";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

/** Admin panel bu menyuda yo'q: u alohida hostda (ADMIN_HOST) ochiladi */
export function UserMenu({ name, roles, activeRole, avatar }: { name: string; roles: string[]; activeRole: string | null; avatar: ReactNode }) {
  const { t } = useT();
  const router = useRouter();
  const [, startTransition] = useTransition();

  const switchRole = (role: "worker" | "employer") => {
    startTransition(async () => {
      await setActiveRole(role);
      router.push(role === "employer" ? "/employer" : "/");
      router.refresh();
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-1 rounded-xl p-1 hover:bg-secondary" aria-label={name}>
        {avatar}
        <ChevronDown className="hidden size-4 text-muted-foreground sm:block" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
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
