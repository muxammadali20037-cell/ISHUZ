import Link from "next/link";
import { Building2, ChevronRight, FileText, History, Inbox, MessageCircle, Users } from "lucide-react";
import { getT } from "@/lib/i18n/server";

/** Ish beruvchi panelidagi bo'limlar (2026-10): ixcham ro'yxat — belgi, nom va qisqa izoh; katta plitkalar yo'q. */
export async function EmployerSections() {
  const { t } = await getT();
  const items = [
    { href: "/employer/vacancies", icon: FileText, key: "vacancies" },
    { href: "/employer/applications", icon: Inbox, key: "applications" },
    { href: "/workers", icon: Users, key: "candidates" },
    { href: "/employer/vacancies?status=closed", icon: History, key: "history" },
    { href: "/messages", icon: MessageCircle, key: "messages" },
    { href: "/company/settings", icon: Building2, key: "company" },
  ] as const;
  return (
    <nav aria-label={t("employer.sections.title")}>
      <h2 className="mb-2 text-base font-bold">{t("employer.sections.title")}</h2>
      <ul className="grid grid-cols-1 divide-y divide-border overflow-hidden rounded-xl border border-border bg-card sm:grid-cols-2 sm:divide-y-0">
        {items.map(({ href, icon: Icon, key }) => (
          <li key={key}>
            <Link href={href} className="flex min-h-14 items-center gap-3 px-4 py-2.5 transition-colors hover:bg-secondary/60">
              <Icon className="size-5 shrink-0 text-primary" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{t(`employer.sections.${key}`)}</span>
                <span className="line-clamp-2 text-sm text-muted-foreground">{t(`employer.sections.${key}_desc`)}</span>
              </span>
              <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
