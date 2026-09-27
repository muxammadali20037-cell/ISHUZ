import type { ReactNode } from "react";
import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import { fullName, initials } from "@/lib/format";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { LastSeenPing } from "@/components/shared/last-seen-ping";
import type { AdminContext } from "../context";
import { NAV_GROUPS, type NavGroup } from "../nav";
import { getSidebarCounts } from "../queries/dashboard";
import { SidebarNav } from "./sidebar-nav";
import { AdminTopbar } from "./admin-topbar";

/** Admin panel qobig'i: chap yon panel (lg+), yuqori panel, kontent */
export async function AdminShell({ ctx, children }: { ctx: AdminContext; children: ReactNode }) {
  const { t, tEnum } = await getT();
  const counts = await getSidebarCounts();
  const groups: NavGroup[] = NAV_GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => !i.perm || ctx.can(i.perm)) })).filter((g) => g.items.length > 0);
  const name = fullName(ctx.session.profile.first_name, ctx.session.profile.last_name) || t("common.role.admin");
  const roleLabel = tEnum("admin_role", ctx.role);
  const avatar = <Avatar src={ctx.session.profile.avatar_url} fallback={initials(ctx.session.profile.first_name, ctx.session.profile.last_name)} size="sm" />;

  return (
    <div className="flex min-h-dvh bg-background">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-border/70 bg-card lg:flex">
        <div className="flex h-14 items-center gap-2 border-b border-border/70 px-5">
          <Link href="/admin" className="flex items-center gap-2 font-extrabold tracking-tight">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-sm text-primary-foreground">IU</span>
            <span className="text-lg">
              Work<span className="text-primary">lyn</span>
            </span>
          </Link>
          <Badge variant="outline" size="sm" className="ml-auto">
            {t("admin.shell.title")}
          </Badge>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-4">
          <SidebarNav groups={groups} counts={counts} />
        </div>
        <div className="border-t border-border/70 p-4">
          <div className="flex items-center gap-2.5">
            {avatar}
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{name}</p>
              <p className="truncate text-xs text-muted-foreground">{roleLabel}</p>
            </div>
          </div>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <AdminTopbar groups={groups} counts={counts} name={name} roleLabel={roleLabel} avatar={avatar} />
        <main className="flex-1 px-4 py-5 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-[1400px]">{children}</div>
        </main>
      </div>
      <LastSeenPing />
    </div>
  );
}
