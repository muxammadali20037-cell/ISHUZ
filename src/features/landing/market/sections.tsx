import { ArrowRight, BadgeCheck } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { Skeleton } from "@/components/ui/skeleton";
import { EMPTY_FIND, findHref } from "@/features/find/params";
import { enterMode } from "@/features/mode/actions";
import { cn } from "@/lib/utils";
import { TileButton } from "../entry-client";
import { SectionHead } from "./section-head";

/** Shu rejimni yozib, berilgan joyga o'tadigan tugma (JS'siz ham ishlaydi) — mavjud "maqsad plitkalari" mexanizmi */
function ModeButton({ mode, next, track, className, children }: { mode: "worker" | "employer"; next: string; track: string; className: string; children: React.ReactNode }) {
  return (
    <form action={enterMode} className="flex">
      <input type="hidden" name="mode" value={mode} />
      <input type="hidden" name="next" value={next} />
      <TileButton data-track="home_cta" data-track-to={track} className={className}>
        {children}
      </TileButton>
    </form>
  );
}

const btnPrimary = "press inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-primary px-5 text-md font-semibold text-primary-foreground hover:bg-primary-hover";
const btnOutline = "press inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-border-strong bg-card px-5 text-md font-semibold text-foreground hover:border-primary/50 hover:text-primary-ink";

/** Vakansiyalar bo'limi skeleti: kartalar/qatorlar balandligiga yaqin — kontent kelganda sahifa siljimaydi */
export function ListSkeleton({ grid = false }: { grid?: boolean }) {
  return (
    <div className="container-wide py-10 sm:py-14" aria-hidden>
      <Skeleton className="h-8 w-56" />
      <Skeleton className="mt-2 h-5 w-80 max-w-full" />
      <div className={cn("mt-6 grid gap-3 sm:gap-4", grid ? "grid-cols-1 sm:grid-cols-2 xl:grid-cols-4" : "grid-cols-1")}>
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className={cn("w-full rounded-2xl", grid ? "h-52" : "h-20")} />
        ))}
      </div>
    </div>
  );
}

/** Ish beruvchilar uchun bo'lim: mavjud oqimlarga — e'lon berish (kirish kerak bo'lsa, joylashda so'raladi va qaytariladi), ishchilar ro'yxati */
export async function EmployerBand() {
  const { t } = await getT();
  const workers = findHref(EMPTY_FIND, { mode: "workers", any: true, region: "all" });
  const benefits = [t("welcome.market.emp_b1"), t("welcome.market.emp_b2"), t("welcome.market.emp_b3"), t("welcome.market.emp_b4")];
  return (
    <section aria-labelledby="home-employers" className="container-wide py-10 sm:py-14">
      <div className="grid grid-cols-1 gap-6 rounded-2xl bg-navy p-5 text-navy-foreground sm:p-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-center lg:p-10">
        <div>
          <h2 id="home-employers" className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {t("welcome.market.emp_title")}
          </h2>
          <p className="mt-2 text-base leading-relaxed text-navy-muted sm:text-lg">{t("welcome.market.emp_desc")}</p>
          <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">
            <ModeButton
              mode="employer"
              next="/post/vacancy"
              track="post_vacancy"
              className="press inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-primary px-5 text-md font-semibold text-primary-foreground hover:bg-primary-hover sm:w-auto"
            >
              {t("welcome.market.emp_post")} <ArrowRight className="size-5" aria-hidden />
            </ModeButton>
            <ModeButton
              mode="employer"
              next={workers}
              track="browse_workers"
              className="press inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md border border-navy-foreground/25 px-5 text-md font-semibold hover:bg-navy-foreground/10 sm:w-auto"
            >
              {t("welcome.market.emp_browse")}
            </ModeButton>
          </div>
        </div>
        <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {benefits.map((b) => (
            <li key={b} className="flex gap-2.5 rounded-lg border border-navy-line p-3 text-sm font-medium leading-snug text-navy-muted sm:text-base">
              <BadgeCheck className="size-5 shrink-0 text-sidebar-accent" aria-hidden />
              <span className="min-w-0">{b}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** Qanday ishlaydi: ikki auditoriya uchun alohida kartalar — qadamlar mavjud oqimga mos */
export async function HowItWorks() {
  const { t } = await getT();
  const cols = [
    {
      key: "seek",
      title: t("welcome.market.how_seek"),
      steps: [1, 2, 3, 4].map((i) => t(`welcome.market.how_seek_${i}`)),
      cta: (
        <ModeButton mode="worker" next={findHref(EMPTY_FIND, { mode: "jobs" })} track="how_seek" className={btnPrimary}>
          {t("welcome.market.how_seek_cta")} <ArrowRight className="size-5" aria-hidden />
        </ModeButton>
      ),
    },
    {
      key: "hire",
      title: t("welcome.market.how_hire"),
      steps: [1, 2, 3, 4].map((i) => t(`welcome.market.how_hire_${i}`)),
      cta: (
        <ModeButton mode="employer" next="/post/vacancy" track="how_hire" className={btnOutline}>
          {t("welcome.market.how_hire_cta")} <ArrowRight className="size-5" aria-hidden />
        </ModeButton>
      ),
    },
  ];
  return (
    <section aria-labelledby="home-how" className="container-wide py-10 sm:py-14">
      <SectionHead id="home-how" title={t("welcome.market.how_title")} />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {cols.map((c) => (
          <div key={c.key} className="flex flex-col rounded-2xl border border-border bg-card p-5 sm:p-6">
            <h3 className="text-lg font-semibold">{c.title}</h3>
            <ol className="mt-4 flex-1 space-y-3">
              {c.steps.map((s, i) => (
                <li key={s} className="flex items-start gap-3">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-semibold text-primary-ink" aria-hidden>
                    {i + 1}
                  </span>
                  <span className="pt-1 text-base font-medium leading-snug">{s}</span>
                </li>
              ))}
            </ol>
            <div className="mt-5">{c.cta}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
