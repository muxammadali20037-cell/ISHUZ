import Link from "next/link";
import { ArrowUpRight, MessageCircle, Briefcase, UserX, Eye } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { initials, shortName } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { PageHeader, SectionHeader } from "@/components/ui/misc";
import { MatchReasons, MatchRing } from "@/components/shared/match-score";
import { ContactCard } from "@/features/contacts/contact-card";
import { STATUS_TONE, type EmployerApplicationDetail as Detail, type ManagedVacancy } from "../types";
import { ApplicationStatusBadge } from "./status-badge";
import { ApplicationTimeline } from "./application-timeline";
import { StatusActionBar } from "./status-action-bar";
import { ReviewSheet } from "./review-sheet";
import { ReviewCard } from "./review-card";
import { TONE_BANNER } from "./tone";
import { InterviewCard } from "./interview-card";
import { ApplicationNotes } from "./application-notes";
import { getApplicationNotes } from "../queries";
import { getSession } from "@/features/auth/session";

/** /employer/vacancies/[id]/applications/[applicationId] — nomzod tafsiloti */
export async function EmployerApplicationDetail({ app, vacancy, canAct }: { app: Detail; vacancy: ManagedVacancy; canAct: boolean }) {
  const [{ t, tEnum }, notes, session] = await Promise.all([getT(), getApplicationNotes(app.id), getSession()]);
  const c = app.candidate;
  const name = c ? shortName(c.first_name, c.last_initial) : t("applications.pipeline.candidate_hidden");
  const pipelineHref = `/employer/vacancies/${vacancy.id}/applications`;

  return (
    <div className="container-narrow py-4 sm:py-8">
      <PageHeader title={t("applications.meta.candidate_title")} subtitle={vacancy.title} backHref={pipelineHref} actions={<ApplicationStatusBadge status={app.status} size="lg" />} />

      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_320px] md:items-start">
        <div className="space-y-4">
          {/* Nomzod */}
          <section className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
            <div className="flex items-start gap-3">
              {c ? <Avatar src={c.avatar_url} fallback={initials(c.first_name, c.last_initial)} size="xl" alt="" /> : <div className="flex size-20 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground"><UserX className="size-8" /></div>}
              <div className="min-w-0 flex-1">
                <h2 className={cn("text-xl font-bold leading-snug", !c && "text-muted-foreground")}>{name}</h2>
                {c?.headline ? <p className="mt-0.5 text-sm text-foreground/90">{c.headline}</p> : null}
                {c ? (
                  <p className="mt-1 inline-flex items-center gap-1 text-sm text-muted-foreground">
                    <Briefcase className="size-4" /> {tEnum("experience_level", c.experience_level)}
                  </p>
                ) : null}
              </div>
            </div>
            {c ? (
              <Button asChild variant="soft" size="sm" className="mt-3">
                <Link href={`/workers/${c.worker_id}`}>
                  {t("applications.candidate.full_profile")} <ArrowUpRight className="size-4" />
                </Link>
              </Button>
            ) : null}
          </section>

          {/* Holat + amallar */}
          <section className={cn("rounded-2xl border p-4", TONE_BANNER[STATUS_TONE[app.status]])}>
            <p className="mb-3 text-sm font-semibold">{t("applications.candidate.status_bar")}</p>
            {canAct ? (
              <StatusActionBar applicationId={app.id} vacancyId={vacancy.id} status={app.status} />
            ) : (
              <p className="inline-flex items-start gap-2 text-sm text-muted-foreground">
                <Eye className="mt-0.5 size-4 shrink-0" /> {t("applications.candidate.view_only_hint")}
              </p>
            )}
            {app.status === "hired" && canAct && !app.my_review ? (
              <div className="mt-3">
                <ReviewSheet source={{ kind: "application", applicationId: app.id, vacancyId: vacancy.id }} label={t("applications.review.rate_candidate")} variant="soft" />
              </div>
            ) : null}
          </section>

          {app.status === "interview" && app.interview_at ? (
            <InterviewCard at={app.interview_at} place={app.interview_place} manage={canAct ? { applicationId: app.id, vacancyId: vacancy.id } : undefined} />
          ) : null}

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
            <SectionHeader title={t("applications.candidate.cover")} />
            {app.cover_message ? <p className="whitespace-pre-line text-sm leading-relaxed">{app.cover_message}</p> : <p className="text-sm text-muted-foreground">{t("applications.pipeline.no_cover")}</p>}
          </section>

          <ApplicationNotes applicationId={app.id} vacancyId={vacancy.id} notes={notes} myId={session?.userId ?? ""} canWrite={canAct} />

          {/* Timeline */}
          <section className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
            <SectionHeader title={t("applications.detail.timeline")} />
            <ApplicationTimeline events={app.events} status={app.status} workerProfileId={c?.profile_id ?? null} viewer="employer" />
          </section>
        </div>

        <aside className="space-y-3 md:sticky md:top-20">
          <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
            <p className="mb-3 text-sm font-semibold">{t("applications.detail.actions")}</p>
            <Button asChild fullWidth>
              <Link href={`/messages/new?application_id=${app.id}`}>
                <MessageCircle className="size-4" />
                {t("applications.detail.write")}
              </Link>
            </Button>
          </div>
          {c ? (
            <div>
              <p className="mb-2 text-sm font-semibold">{t("applications.candidate.contact")}</p>
              <ContactCard profileId={c.profile_id} />
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
