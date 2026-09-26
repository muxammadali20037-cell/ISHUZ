import { MapPin, Briefcase, ShieldCheck, Eye, Clock } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { ageFromBirthDate, formatRelative, initials, shortName } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CategoryIcon } from "@/components/shared/category-icon";
import type { Enums } from "@/types/database.types";
import type { CandidateProfile } from "../types";

const statusDot: Record<Enums<"worker_status">, string> = { active: "bg-success", open: "bg-warning", not_looking: "bg-muted-foreground" };

/** Nomzod sarlavhasi: avatar, "Ism F.", headline, kasb, holat, tasdiq, yosh, hudud, faollik */
export async function CandidateHeader({ candidate, phoneVerified }: { candidate: CandidateProfile; phoneVerified: boolean }) {
  const { t, tEnum, locale, name } = await getT();
  const c = candidate;
  const displayName = shortName(c.first_name, c.last_initial);
  const age = ageFromBirthDate(c.birth_date);
  const location = [c.district ? name(c.district) : null, c.region ? name(c.region) : null].filter(Boolean).join(", ");

  return (
    <header className="rounded-2xl border border-border/70 bg-card p-4 sm:p-5">
      <div className="flex items-start gap-4">
        <Avatar src={c.avatar_url} fallback={initials(c.first_name, c.last_initial)} size="xl" alt="" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h1 className="text-xl font-bold sm:text-2xl">{displayName}</h1>
            {phoneVerified ? (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-primary" title={t("workers.candidate.verified_phone")}>
                <ShieldCheck className="size-4" aria-hidden />
                <span className="sr-only">{t("workers.candidate.verified_phone")}</span>
              </span>
            ) : null}
            {age !== null ? <span className="text-sm text-muted-foreground">· {t("workers.candidate.age", { age })}</span> : null}
          </div>
          <p className="mt-0.5 text-[15px] text-foreground/90">{c.headline ?? (c.category ? name(c.category) : "")}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {c.category ? (
              <Badge variant="primary" size="lg">
                <CategoryIcon name={c.category.icon} className="size-3.5" />
                {name(c.category)}
                {c.subcategory ? ` · ${name(c.subcategory)}` : ""}
              </Badge>
            ) : null}
            <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
              <span className={cn("size-2 rounded-full", statusDot[c.status])} aria-hidden />
              {tEnum("worker_status_short", c.status)}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
        {location ? (
          <span className="inline-flex items-center gap-1">
            <MapPin className="size-4" /> {location}
          </span>
        ) : null}
        <span className="inline-flex items-center gap-1">
          <Briefcase className="size-4" /> {tEnum("experience_level", c.experience_level)}
        </span>
        <span className="inline-flex items-center gap-1">
          <Clock className="size-4" /> {t("workers.candidate.last_active", { time: formatRelative(c.last_active_at, locale) })}
        </span>
        <span className="inline-flex items-center gap-1">
          <Eye className="size-4" /> {t("workers.candidate.views", { count: c.views_count })}
        </span>
      </div>

      <div className="mt-4">
        <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
          <span>{t("workers.candidate.completeness", { percent: c.completeness })}</span>
        </div>
        <Progress value={c.completeness} tone={c.completeness >= 80 ? "success" : c.completeness >= 50 ? "primary" : "warning"} className="h-1.5" />
      </div>
    </header>
  );
}
