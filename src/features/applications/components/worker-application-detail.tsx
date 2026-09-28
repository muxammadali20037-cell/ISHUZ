import Link from "next/link";
import { ArrowUpRight, MessageCircle, BadgeCheck, PartyPopper } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { PageHeader, SectionHeader } from "@/components/ui/misc";
import { MatchReasons, MatchRing } from "@/components/shared/match-score";
import { SalaryText } from "@/components/shared/salary-text";
import { ContactCard } from "@/features/contacts/contact-card";
import { isTerminalStatus, STATUS_TONE, type WorkerApplicationDetail as Detail } from "../types";
import { ApplicationStatusBadge } from "./status-badge";
import { ApplicationTimeline } from "./application-timeline";
import { WithdrawButton } from "./withdraw-button";
import { ReviewSheet } from "./review-sheet";
import { ReviewCard } from "./review-card";
import { TONE_BANNER } from "./tone";
import { InterviewCard } from "./interview-card";

/** /applications/[id] — ishchi uchun ariza tafsiloti */
export async function WorkerApplicationDetail({ app, userId }: { app: Detail; userId: string }) {
  const { t } = await getT();
  const v = app.vacancy;
  const terminal = isTerminalStatus(app.status);
  const tone = STATUS_TONE[app.status];

  return (
    <div className="container-narrow py-4 sm:py-8">
      <PageHeader title={t("applications.meta.detail_title")} backHref="/applications" actions={<ApplicationStatusBadge status={app.status} size="lg" />} />

      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_320px] md:items-start">
        <div className="space-y-4">
          {/* Vakansiya */}
          <section className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <Avatar src={v?.company?.logo_url} fallback={(v?.company?.name ?? v?.title ?? "?").slice(0, 2)} square size="lg" alt="" />
              <div className="min-w-0 flex-1">
                <h2 className={cn("text-lg font-bold leading-snug", !v && "text-muted-foreground")}>{v?.title ?? t("applications.list.vacancy_unavailable")}</h2>
                {v ? (
                  <p className="mt-0.5 flex items-center gap-1 text-sm text-muted-foreground">
                    {v.company?.name ?? t("common.role.employer")}
                    {v.company?.verification_status === "verified" ? <BadgeCheck className="size-4 text-primary" aria-label={t("common.labels.verified")} /> : null}
                  </p>
                ) : null}
                {v ? <SalaryText from={v.salary_from} to={v.salary_to} type={v.salary_type} negotiable={v.salary_negotiable} className="mt-2 block text-[15px]" /> : null}
              </div>
            </div>
            {v ? (
              <Button asChild variant="soft" size="sm" className="mt-3">
                <Link href={`/jobs/${v.slug}`}>
                  {t("applications.detail.open_vacancy")} <ArrowUpRight className="size-4" />
                </Link>
              </Button>
            ) : null}
          </section>

          {/* Holat banneri */}
          <section className={cn("rounded-2xl border p-4", TONE_BANNER[tone])}>
            {app.status === "hired" ? (
              <div className="flex items-start gap-3">
                <PartyPopper className="mt-0.5 size-5 shrink-0 text-success" />
                <div>
                  <p className="font-semibold">{t("applications.detail.hired_title")}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">{t("applications.detail.hired_desc")}</p>
                </div>
              </div>
            ) : (
              <p className="text-sm font-medium">{t(`applications.status_hint.${app.status}`)}</p>
            )}
            {app.status === "hired" && !app.my_review ? (
              <div className="mt-3">
                <ReviewSheet source={{ kind: "application", applicationId: app.id }} label={t("applications.review.rate_employer")} />
              </div>
            ) : null}
          </section>

          {app.status === "interview" && app.interview_at ? <InterviewCard at={app.interview_at} place={app.interview_place} /> : null}

          {app.my_review ? <ReviewCard review={app.my_review} /> : null}

          {/* Moslik */}
          {app.match_score !== null ? (
            <section className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
              <SectionHeader title={t("applications.detail.match")} />
              <MatchRing score={app.match_score} />
              <MatchReasons reasons={app.match_reasons} className="mt-4" />
            </section>
          ) : null}

          {/* Xabar */}
          <section className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
            <SectionHeader title={t("applications.detail.cover")} />
            {app.cover_message ? <p className="whitespace-pre-line text-sm leading-relaxed">{app.cover_message}</p> : <p className="text-sm text-muted-foreground">{t("applications.detail.cover_empty")}</p>}
          </section>

          {/* Timeline */}
          <section className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
            <SectionHeader title={t("applications.detail.timeline")} />
            <ApplicationTimeline events={app.events} status={app.status} workerProfileId={userId} viewer="worker" />
          </section>
        </div>

        {/* Amallar */}
        <aside className="space-y-3 md:sticky md:top-20">
          <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
            <p className="mb-3 text-sm font-semibold">{t("applications.detail.actions")}</p>
            <div className="space-y-2">
              <Button asChild fullWidth>
                <Link href={`/messages/new?application_id=${app.id}`}>
                  <MessageCircle className="size-4" />
                  {t("applications.detail.write")}
                </Link>
              </Button>
              {!terminal ? <WithdrawButton applicationId={app.id} fullWidth /> : <p className="text-center text-xs text-muted-foreground">{t("applications.detail.closed_hint")}</p>}
            </div>
          </div>
          {v?.owner_profile_id ? (
            <div>
              <p className="mb-2 text-sm font-semibold">{t("applications.detail.contact")}</p>
              <ContactCard profileId={v.owner_profile_id} />
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
