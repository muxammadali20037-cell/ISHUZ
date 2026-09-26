import Link from "next/link";
import { Images, Shield } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { Button } from "@/components/ui/button";
import type { SessionContext } from "@/features/auth/session";
import { getCompleteness, getMyContacts, getMyRating, getWorkerProfileFull } from "../queries";
import { ProfileHeader } from "./profile-header";
import { CompletenessCard } from "./completeness-card";
import { RatingCard } from "./rating-card";
import { AboutSection, EducationSection, ExperienceSection, LanguagesSection, LocationSection, PortfolioSection, PreferencesSection, SkillsSection } from "./profile-sections";

/** Ish qidiruvchi profili (o'zi uchun): mobil — bitta ustun, desktop — kontent + yon panel */
export async function WorkerProfileView({ session, workerId }: { session: SessionContext; workerId: string }) {
  const { t, tEnum } = await getT();
  const [data, completeness, rating, contacts] = await Promise.all([
    getWorkerProfileFull(workerId),
    getCompleteness(workerId),
    getMyRating(session.userId),
    getMyContacts(session.userId),
  ]);
  if (!data) return null;

  const privacy = (
    <Link href="/settings" className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 text-sm shadow-sm transition-colors hover:bg-secondary/60">
      <Shield className="size-5 shrink-0 text-primary" />
      <span className="min-w-0 flex-1">
        {t("profile.view.privacy_hint", { setting: tEnum("phone_visibility", contacts?.phone_visibility ?? "applicants") })}
      </span>
      <span className="shrink-0 font-medium text-primary">{t("profile.view.privacy_change")}</span>
    </Link>
  );

  return (
    <div className="container-app py-4 sm:py-6">
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-6">
        <div className="space-y-4">
          <ProfileHeader session={session} data={data} />
          <div className="lg:hidden">
            <CompletenessCard completeness={completeness} />
          </div>
          <AboutSection data={data} />
          <LocationSection data={data} />
          <ExperienceSection data={data} />
          <SkillsSection data={data} />
          <LanguagesSection data={data} />
          <EducationSection data={data} />
          <PortfolioSection data={data} />
          <div className="flex justify-end">
            <Button asChild variant="soft" size="sm">
              <Link href="/profile/portfolio">
                <Images className="size-4" /> {t("profile.view.portfolio_manage")}
              </Link>
            </Button>
          </div>
          <PreferencesSection data={data} />
          <div className="lg:hidden">
            <RatingCard rating={rating} />
          </div>
          <div className="lg:hidden">{privacy}</div>
        </div>
        <aside className="hidden space-y-4 lg:sticky lg:top-20 lg:block">
          <CompletenessCard completeness={completeness} />
          <RatingCard rating={rating} />
          {privacy}
        </aside>
      </div>
    </div>
  );
}
