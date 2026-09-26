import Link from "next/link";
import { ArrowRight, BadgeCheck, Building2, LayoutDashboard, MapPin, Settings, UserRound } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { initials } from "@/lib/format";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { SessionContext } from "@/features/auth/session";
import { EMPLOYER_STAT_KEYS } from "../pure";
import type { getEmployerSummary } from "../queries";

type EmployerSummaryData = NonNullable<Awaited<ReturnType<typeof getEmployerSummary>>>;

/** Faqat ish beruvchi roli bo'lganlar uchun /profile ko'rinishi */
export async function EmployerSummary({ session, data }: { session: SessionContext; data: EmployerSummaryData }) {
  const { t, tEnum, name } = await getT();
  const { employer, stats } = data;
  const company = employer.company;
  const title = company?.name ?? employer.display_name ?? `${session.profile.first_name} ${session.profile.last_name}`.trim() ?? "";
  const verification = company?.verification_status ?? employer.verification_status;
  const location = [name(employer.region), name(employer.district)].filter(Boolean).join(", ");

  return (
    <div className="container-narrow space-y-4 py-4 sm:py-6">
      <Card>
        <CardContent className="p-4 sm:p-6">
          <div className="flex items-start gap-4">
            <Avatar src={company?.logo_url ?? session.profile.avatar_url} fallback={initials(title.split(" ")[0], title.split(" ")[1])} size="xl" square />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("profile.employer.title")}</p>
              <h1 className="truncate text-xl font-bold sm:text-2xl">{title || t("profile.employer.no_name")}</h1>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Badge variant="primary">
                  <Building2 /> {tEnum("employer_type", employer.employer_type)}
                </Badge>
                <Badge variant={verification === "verified" ? "success" : verification === "pending" ? "warning" : "default"}>
                  {verification === "verified" ? <BadgeCheck /> : null} {tEnum("verification_status", verification)}
                </Badge>
              </div>
              {location ? (
                <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                  <MapPin className="size-4" /> {location}
                </p>
              ) : null}
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:flex">
            <Button asChild>
              <Link href="/employer">
                <LayoutDashboard className="size-4" /> {t("profile.employer.dashboard")}
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/company/settings">
                <Settings className="size-4" /> {t("profile.employer.company_settings")}
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 sm:p-5">
          <h2 className="text-base font-semibold">{t("profile.employer.stats_title")}</h2>
          <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {EMPLOYER_STAT_KEYS.map((key) => (
              <div key={key} className="rounded-xl bg-secondary/60 p-3">
                <dt className="text-xs text-muted-foreground">{t(`profile.employer.stats.${key}`)}</dt>
                <dd className="mt-1 tabular text-xl font-bold">{stats[key]}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      {!session.workerId ? (
        <Link href="/onboarding/worker" className="flex items-center gap-4 rounded-2xl border border-dashed border-primary/40 bg-primary-soft/40 p-4 transition-colors hover:bg-primary-soft">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <UserRound className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">{t("profile.employer.create_worker")}</span>
            <span className="block text-sm text-muted-foreground">{t("profile.employer.create_worker_hint")}</span>
          </span>
          <ArrowRight className="size-5 shrink-0 text-primary" />
        </Link>
      ) : null}
    </div>
  );
}
