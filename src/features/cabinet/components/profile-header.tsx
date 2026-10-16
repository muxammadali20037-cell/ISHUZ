import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import { initials } from "@/lib/format";
import type { SessionContext } from "@/features/auth/session";
import type { AppMode } from "@/features/mode/mode";
import { Avatar } from "@/components/ui/avatar";
import { getWorkerDashboardStats } from "@/features/jobs/queries";
import { getDashboardStats } from "@/features/employer/queries";

const num = (n: number) => new Intl.NumberFormat("ru-RU").format(n);

/**
 * Profil sarlavhasi (S3): avatar, ism, joriy rol; ish izlovchida — profil to'liqligi (bazadagi `completeness`, 0–100) va
 * faoliyat sonlari (arizalar, takliflar, saqlangan, ko'rishlar); ish beruvchida — faol vakansiyalar, yangi va jami arizalar,
 * ishga olinganlar. Hammasi haqiqiy RPC natijasi; olinmasa — son ko'rsatilmaydi.
 */
export async function ProfileHeader({ session, mode }: { session: SessionContext; mode: AppMode | null }) {
  const { t } = await getT();
  const employer = mode === "employer" || (!mode && !session.workerId && !!session.employerId);
  const fullName = [session.profile.first_name, session.profile.last_name].filter((x) => x?.trim()).join(" ") || t("easy.cabinet.title");
  const [workerStats, employerStats] = await Promise.all([
    !employer && session.workerId ? getWorkerDashboardStats() : Promise.resolve(null),
    employer && session.employerId ? getDashboardStats() : Promise.resolve(null),
  ]);
  const counters = workerStats
    ? [
        { key: "applications", href: "/applications", value: workerStats.applications },
        { key: "offers", href: "/offers", value: workerStats.offers },
        { key: "saved", href: "/saved", value: workerStats.saved },
        { key: "views", href: "/profile", value: workerStats.profile_views },
      ]
    : employerStats
      ? [
          { key: "active_vacancies", href: "/employer/vacancies", value: employerStats.active_vacancies },
          { key: "new_applications", href: "/employer/applications", value: employerStats.new_applications },
          { key: "applications", href: "/employer/applications", value: employerStats.applications },
          { key: "hired", href: "/employer/applications", value: employerStats.hired },
        ]
      : [];
  const completeness = workerStats ? Math.max(0, Math.min(100, Math.round(workerStats.completeness))) : null;

  return (
    <section aria-labelledby="cabinet-name" className="space-y-4 rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
      <div className="flex items-center gap-3">
        <Avatar src={session.profile.avatar_url} fallback={initials(session.profile.first_name, session.profile.last_name)} size="lg" alt="" />
        <div className="min-w-0">
          <h2 id="cabinet-name" className="truncate text-xl font-extrabold leading-tight">
            {fullName}
          </h2>
          <p className="text-base text-muted-foreground">{employer ? t("easy.cabinet.header.employer") : t("easy.cabinet.header.worker")}</p>
        </div>
      </div>

      {completeness !== null ? (
        <div>
          <div className="flex items-center justify-between gap-3 text-sm font-semibold">
            <span>{t("easy.cabinet.header.completeness", { value: completeness })}</span>
            {completeness < 100 ? (
              <Link href="/profile" className="inline-flex min-h-11 items-center text-primary hover:underline">
                {t("easy.cabinet.header.complete_cta")}
              </Link>
            ) : null}
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-secondary" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={completeness} aria-label={t("easy.cabinet.header.completeness", { value: completeness })}>
            <div className="h-full rounded-full bg-primary" style={{ width: `${completeness}%` }} />
          </div>
        </div>
      ) : null}

      {counters.length ? (
        <ul aria-label={t("easy.cabinet.header.activity")} className="grid grid-cols-4 gap-2">
          {counters.map((c) => (
            <li key={c.key} className="flex">
              <Link href={c.href} className="press flex w-full flex-col items-center justify-center rounded-xl bg-secondary px-1 py-2 text-center hover:bg-primary-soft">
                <span className="text-lg font-extrabold tabular leading-tight">{num(c.value)}</span>
                <span className="text-2xs font-semibold leading-tight text-muted-foreground">{t(`easy.cabinet.header.${c.key}`)}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
