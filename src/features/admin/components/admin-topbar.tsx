"use client";

import { useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { Menu, ExternalLink, LogOut } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { signOut } from "@/features/auth/actions";
import { LanguageSwitcher } from "@/components/shared/language-switcher";
import { Button } from "@/components/ui/button";
import { Dialog, Sheet } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import type { NavGroup } from "../nav";
import type { SidebarCounts } from "../queries/dashboard";
import { SidebarNav } from "./sidebar-nav";

/** Yuqori panel: mobil menyu (Sheet), admin ismi/roli, til almashtirgich, chiqish */
export function AdminTopbar({
  groups,
  counts,
  name,
  roleLabel,
  avatar,
}: {
  groups: NavGroup[];
  counts: SidebarCounts;
  name: string;
  roleLabel: string;
  avatar: ReactNode;
}) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border/70 bg-card/90 px-4 backdrop-blur supports-[backdrop-filter]:bg-card/80 sm:px-6">
      <Dialog open={open} onOpenChange={setOpen}>
        <Button variant="ghost" size="icon-sm" className="lg:hidden" aria-label={t("admin.shell.menu")} onClick={() => setOpen(true)}>
          <Menu className="size-5" />
        </Button>
        <Sheet title={t("admin.shell.title")} className="sm:max-w-sm">
          <SidebarNav groups={groups} counts={counts} onNavigate={() => setOpen(false)} />
        </Sheet>
      </Dialog>
      <Link href="/admin" className="flex items-center gap-2 font-extrabold tracking-tight lg:hidden">
        <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-xs text-primary-foreground">IB</span>
        <span className="text-base">{t("admin.shell.title")}</span>
      </Link>
      <div className="flex-1" />
      <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
        <Link href="/">
          <ExternalLink className="size-4" />
          {t("admin.shell.open_site")}
        </Link>
      </Button>
      <LanguageSwitcher />
      <div className="ml-1 flex items-center gap-2 rounded-xl pl-1">
        {avatar}
        <div className="hidden min-w-0 sm:block">
          <p className="max-w-[160px] truncate text-sm font-semibold leading-tight">{name}</p>
          <Badge variant="primary" size="sm">
            {roleLabel}
          </Badge>
        </div>
      </div>
      <Button variant="ghost" size="icon-sm" aria-label={t("common.nav.logout")} onClick={() => startTransition(() => signOut())}>
        <LogOut className="size-4.5" />
      </Button>
    </header>
  );
}
