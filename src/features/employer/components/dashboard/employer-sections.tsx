import Link from "next/link";
import { Building2, ChevronRight, FileText, History, Inbox, MessageCircle, Users } from "lucide-react";
import { getT } from "@/lib/i18n/server";

/** Ish beruvchi panelidagi asosiy bo'limlar: katta qatorlar (ikon + nom + izoh). Har biri bitta vazifani bajaradi. */
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
    <nav aria-label={t("employer.sections.title")} data-tour="employer-sections">
      <h2 className="mb-3 text-lg font-bold">{t("employer.sections.title")}</h2>
      <ul className="grid gap-2 sm:grid-cols-2">
        {items.map(({ href, icon: Icon, key }) => (
          <li key={key}>
            <Link href={href} className="flex min-h-16 items-center gap-3 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary/50">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
                <Icon className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{t(`employer.sections.${key}`)}</span>
                <span className="block truncate text-sm text-muted-foreground">{t(`employer.sections.${key}_desc`)}</span>
              </span>
              <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
