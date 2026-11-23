"use client";

import { useId, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  BriefcaseBusiness,
  CalendarDays,
  ChevronDown,
  Clock,
  ExternalLink,
  FileCheck2,
  FileText,
  Gift,
  GraduationCap,
  Loader2,
  MapPin,
  Phone,
  RotateCw,
  Send,
  UserRound,
  Wallet,
} from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { SalaryText } from "@/components/shared/salary-text";
import { SaveButton } from "@/features/saved/components/save-button";
import { RevealPhone } from "@/features/contacts/reveal-phone";
import { levelToExperience } from "@/features/post/types";
import { openVacancyCard, openWorkerCard, type CardPhone, type VacancyCardDetails } from "../card-details";
import { OrgMark, usePlace, usePosted, type JobCardData, type WorkerCardData } from "./result-cards";

/**
 * Yordamchi (AI) javobidagi kartalar (ega, 2026-11-19: "tartib bilan, rangli, alohida rangda, ichida telefonigacha
 * ko'rinsin; sodda va chiroyli; nomi tagida yashil «E'lonni to'liq ko'rish» — bosilsa hamma ma'lumot tartib bilan").
 *
 * 2026-11-21 (ega: "ranglar yemagan, bolalarcha"): oq sokin karta, qizil holat chat kartasida yo'q (e'lon sahifasida bor),
 * "E'lonni to'liq ko'rish" — sokin chegarali tugma.
 * Yopiq: lavozim · maosh · ish beruvchi → "E'lonni to'liq ko'rish". Ochilganda — shu kartaning
 * o'zida qatorma-qator: manzil, grafik, tajriba, bandlik, (ma'lumot/yosh/jins), joylangan sana, ish haqida, qulayliklar,
 * telefon (bosish — aniq harakat: raqam ham ochiladi, limitlar o'sha-o'sha) va "Ariza yuborish".
 */

// oq, sokin karta (ega, 2026-11-21: "ranglar yemagan, bolalarcha") — rang faqat muhim joyda (maosh, tugma)
const cardCls = "relative rounded-2xl border border-border bg-card p-4 shadow-sm";
// ega (2026-11-23): "E'lonni to'liq ko'rish" — biroz kichikroq, sariq shishasimon, soyali (bosh sahifadagi "E'lon berish" uslubida)
const openBtnCls =
  "press relative isolate mt-3 inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-highlight-hover/60 bg-highlight/90 px-4 text-sm font-bold text-highlight-foreground shadow-md shadow-highlight/30 transition-[transform,box-shadow] hover:-translate-y-px hover:bg-highlight hover:shadow-lg hover:shadow-highlight/40 disabled:opacity-70";
const EXPERIENCE_PRESETS = [60, 36, 24, 12, 6, 0] as const;

type Loaded<T> = { phase: "idle" | "loading" | "error" } | ({ phase: "ready" } & T);

/** Bitta qator: rangli belgi + nom + qiymat */
function Row({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-ink [&>svg]:size-4.5" aria-hidden>
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
        <dd className="break-words text-base font-semibold leading-snug">{children}</dd>
      </div>
    </div>
  );
}

/** Yopiq kartada hudud — to'liq (kesilmaydi), kichik kulrang qator */
/**
 * kartaning rasmi: haqiqiy ish joyi surati («Ish joyi surati» belgisi bilan) yoki egasi so'ragan AI rasm (belgisiz — ega,
 * 2026-11-22). AI rasmda aniq odam portreti chizilmaydi (listing-image/prompt.ts) — u kimningdir surati deb o'ylanmaydi.
 */
export interface CardImage {
  src: string;
  ai: boolean;
}

function CardBanner({ image, alt }: { image: CardImage; alt: string }) {
  const { t } = useT();
  return (
    <figure className="relative mb-3 overflow-hidden rounded-lg border border-border bg-secondary" data-ai-card-image={image.ai ? "ai" : "photo"}>
      {/* eslint-disable-next-line @next/next/no-img-element -- ochiq bucket'dagi tayyor JPEG; kartada kichik, lazy */}
      <img src={image.src} alt={alt} width={1536} height={1024} loading="lazy" decoding="async" className="aspect-[16/7] w-full object-cover" />
      {image.ai ? null : <figcaption className="absolute bottom-1.5 left-1.5 rounded-md bg-black/60 px-1.5 py-0.5 text-xs font-semibold text-white">{t("easy.photo.label")}</figcaption>}
    </figure>
  );
}

function PlaceLine({ text }: { text: string }) {
  return (
    <p className="mt-1.5 flex items-start gap-1.5 text-sm text-muted-foreground" data-ai-card-place>
      <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span className="min-w-0 break-words">{text}</span>
    </p>
  );
}

function OpenButton({ open, loading, controls, onClick }: { open: boolean; loading: boolean; controls: string; onClick: () => void }) {
  const { t } = useT();
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={open}
      aria-controls={controls}
      className={openBtnCls}
      data-ai-card-open
    >
      {/* shisha: tepada ingichka yaltirash va yuqori yarmida yumshoq oq nur (tugma ichida — tashqariga chiqmaydi) */}
      <span aria-hidden className="absolute inset-x-3 top-0 -z-10 h-px bg-card/80" />
      <span aria-hidden className="absolute inset-x-0 top-0 -z-10 h-1/2 rounded-t-xl bg-card/25" />
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <FileText className="size-4" aria-hidden />}
      {open ? t("easy.aicard.close") : t("easy.aicard.open")}
      <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} aria-hidden />
    </button>
  );
}

function PhoneBlock({ kind, id, phone, signedIn, next }: { kind: "vacancy" | "worker"; id: string; phone: CardPhone; signedIn: boolean; next: string }) {
  const { t } = useT();
  return (
    <section className="space-y-2" data-ai-card-phone>
      <h4 className="flex items-center gap-2 text-sm font-bold">
        <Phone className="size-4 text-success" aria-hidden /> {t("easy.aicard.phone")}
      </h4>
      <RevealPhone kind={kind} id={id} initial={phone} loginHref={signedIn ? null : `/auth?next=${encodeURIComponent(next)}`} />
    </section>
  );
}

function LoadError({ onRetry }: { onRetry: () => void }) {
  const { t } = useT();
  return (
    <div className="space-y-2">
      <p className="text-base text-muted-foreground">{t("easy.aicard.load_error")}</p>
      <button type="button" onClick={onRetry} className="press flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-border bg-card text-base font-semibold hover:bg-secondary">
        <RotateCw className="size-4" aria-hidden /> {t("contacts.reveal.retry")}
      </button>
    </div>
  );
}

export function AiJobCard({ job, saved, image }: { job: JobCardData; saved?: boolean; image?: CardImage | null }) {
  const { t, tEnum, name } = useT();
  const place = usePlace();
  const posted = usePosted();
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<Loaded<{ details: VacancyCardDetails; phone: CardPhone; signedIn: boolean }>>({ phase: "idle" });
  const negotiable = job.salary_negotiable || (!job.salary_from && !job.salary_to);

  const load = () => {
    setData({ phase: "loading" });
    openVacancyCard({ slug: job.slug })
      .catch(() => null)
      .then((res) => setData(res?.ok && res.data ? { phase: "ready", ...res.data } : { phase: "error" }));
  };
  const toggle = () => {
    setOpen((o) => !o);
    if (!open && (data.phase === "idle" || data.phase === "error")) load();
  };

  const when = posted(job.published_at);
  return (
    <article className={cardCls} data-ai-card="job">
      {image ? <CardBanner image={image} alt={job.title} /> : null}
      <div className="flex items-start gap-2">
        <h3 className="min-w-0 flex-1 break-words text-lg font-bold leading-snug">
          <Link href={`/jobs/${job.slug}`} className="hover:underline">
            {job.title}
          </Link>
        </h3>
        {saved !== undefined ? <SaveButton kind="vacancy" id={job.id} initial={saved} label={job.title} variant="ghost" className="-mr-2 -mt-1.5 shrink-0" /> : null}
      </div>
      <SalaryText
        from={job.salary_from}
        to={job.salary_to}
        type={job.salary_type}
        negotiable={job.salary_negotiable}
        className={cn("mt-2 text-sm font-bold", negotiable ? "block font-semibold text-muted-foreground" : "inline-block max-w-full rounded-full bg-primary-soft px-3 py-1 text-primary-ink")}
      />
      {job.employer_name ? (
        <p className="mt-2 flex min-w-0 items-center gap-2 text-base font-semibold">
          <OrgMark name={job.employer_name} />
          <span className="truncate">{job.employer_name}</span>
          {job.employer_verified ? <BadgeCheck className="size-4 shrink-0 text-primary-ink" role="img" aria-label={t("jobs.detail.company_verified")} /> : null}
        </p>
      ) : null}
      <PlaceLine text={place(job, job.is_remote)} />

      <OpenButton open={open} loading={open && data.phase === "loading"} controls={panelId} onClick={toggle} />

      {open ? (
        <div id={panelId} className="mt-3 space-y-4 rounded-xl bg-secondary/60 p-3 sm:p-4" data-ai-card-details>
          {data.phase === "ready" ? (
            <JobDetails d={data.details} when={when} place={place(job, job.is_remote)} name={name} t={t} tEnum={tEnum} />
          ) : data.phase === "error" ? (
            <LoadError onRetry={load} />
          ) : (
            <p className="flex items-center gap-2 text-base text-muted-foreground">
              <Loader2 className="size-5 animate-spin" aria-hidden /> {t("easy.aicard.loading")}
            </p>
          )}
          {data.phase === "ready" ? <PhoneBlock kind="vacancy" id={job.id} phone={data.phone} signedIn={data.signedIn} next={`/jobs/${job.slug}`} /> : null}
          {data.phase === "ready" ? (
            <div className="space-y-2 border-t border-border pt-3">
              <Link
                href={`/jobs/${job.slug}?apply=1`}
                className="press flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-base font-bold text-primary-foreground shadow-sm hover:bg-primary-hover"
                data-ai-card-apply
              >
                <Send className="size-5" aria-hidden /> {t("easy.card.apply")}
              </Link>
              <Link href={`/jobs/${job.slug}`} className="flex min-h-11 items-center justify-center gap-1 text-sm font-semibold text-primary-ink hover:underline">
                {t("easy.aicard.open_page")} <ArrowRight className="size-4" aria-hidden />
              </Link>
            </div>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

type T = ReturnType<typeof useT>;

function JobDetails({ d, when, place, name, t, tEnum }: { d: VacancyCardDetails; when: string | null; place: string; name: T["name"]; t: T["t"]; tEnum: T["tEnum"] }) {
  const expKey = EXPERIENCE_PRESETS.find((p) => d.experienceMonths >= p) ?? 0;
  const age =
    d.ageMin && d.ageMax
      ? t("jobs.detail.age_range", { min: d.ageMin, max: d.ageMax })
      : d.ageMin
        ? t("jobs.detail.age_from", { min: d.ageMin })
        : d.ageMax
          ? t("jobs.detail.age_to", { max: d.ageMax })
          : null;
  const extras = [...d.officialTerms.map((b) => ({ ...b, official: true })), ...d.benefits.map((b) => ({ ...b, official: false }))];
  return (
    <>
      <dl className="space-y-3">
        <Row icon={<MapPin />} label={t("jobs.detail.location")}>
          {place}
          {d.address ? <span className="block text-sm font-normal text-muted-foreground">{d.address}</span> : null}
          {d.mapHref ? (
            <a href={d.mapHref} target="_blank" rel="noopener noreferrer" className="mt-0.5 inline-flex min-h-9 items-center gap-1 text-sm font-semibold text-primary-ink hover:underline">
              {t("jobs.detail.map")} <ExternalLink className="size-3.5" aria-hidden />
            </a>
          ) : null}
        </Row>
        <Row icon={<Clock />} label={t("jobs.detail.schedule")}>
          {tEnum("work_schedule", d.schedule)}
          {d.time ? <span className="font-normal text-muted-foreground"> · {d.time}</span> : null}
        </Row>
        <Row icon={<BriefcaseBusiness />} label={t("jobs.detail.experience")}>
          {tEnum("experience_min_months", String(expKey))}
        </Row>
        <Row icon={<FileCheck2 />} label={t("jobs.detail.employment")}>
          {tEnum("employment_type", d.employment)}
          <span className={cn("font-normal", d.format === "official" ? "text-success" : "text-muted-foreground")}> · {tEnum("work_format", d.format)}</span>
        </Row>
        {d.education ? (
          <Row icon={<GraduationCap />} label={t("jobs.detail.education")}>
            {tEnum("education_level", d.education)}
          </Row>
        ) : null}
        {age || d.gender ? (
          <Row icon={<UserRound />} label={[age ? t("jobs.detail.age") : null, d.gender ? t("jobs.detail.gender") : null].filter(Boolean).join(" · ")}>
            {[age, d.gender ? tEnum("gender", d.gender) : null].filter(Boolean).join(" · ")}
          </Row>
        ) : null}
        {when ? (
          <Row icon={<CalendarDays />} label={t("jobs.detail.stat_published")}>
            <span suppressHydrationWarning>{when}</span>
          </Row>
        ) : null}
      </dl>

      <section className="space-y-1" data-ai-card-about>
        <h4 className="text-sm font-bold">{t("easy.aicard.about")}</h4>
        <p className="whitespace-pre-line break-words text-base">{d.description ?? <span className="text-muted-foreground">{t("jobs.detail.no_description")}</span>}</p>
      </section>

      {extras.length ? (
        <section className="space-y-1.5">
          <h4 className="text-sm font-bold">{t("jobs.detail.benefits")}</h4>
          <ul className="flex flex-wrap gap-1.5">
            {extras.map((b) => (
              <li key={b.code} className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold", b.official ? "bg-success-soft text-success" : "bg-secondary text-foreground")}>
                {b.official ? <FileCheck2 className="size-3.5" aria-hidden /> : <Gift className="size-3.5" aria-hidden />} {name(b)}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}

export function AiWorkerCard({ worker, saved, image }: { worker: WorkerCardData; saved?: boolean; image?: CardImage | null }) {
  const { t, tEnum, name, locale } = useT();
  const place = usePlace();
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<Loaded<{ phone: CardPhone; signedIn: boolean }>>({ phase: "idle" });
  const profession = worker.profession_name_uz
    ? name({ name_uz: worker.profession_name_uz, name_ru: worker.profession_name_ru ?? worker.profession_name_uz, name_en: worker.profession_name_en })
    : (worker.headline ?? "");
  const exp = levelToExperience(worker.experience_level);
  const fullName = `${worker.first_name}${worker.last_initial ? ` ${worker.last_initial}.` : ""}`;

  const load = () => {
    setData({ phase: "loading" });
    openWorkerCard({ id: worker.id })
      .catch(() => null)
      .then((res) => setData(res?.ok && res.data ? { phase: "ready", ...res.data } : { phase: "error" }));
  };
  const toggle = () => {
    setOpen((o) => !o);
    if (!open && (data.phase === "idle" || data.phase === "error")) load();
  };

  return (
    <article className={cardCls} data-ai-card="worker">
      {image ? <CardBanner image={image} alt={profession || fullName} /> : null}
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="break-words text-lg font-bold leading-snug">
            <Link href={`/listing/${worker.id}`} className="hover:underline">
              {fullName}
            </Link>
          </h3>
          {profession ? <p className="break-words text-base font-semibold text-primary-ink">{profession}</p> : null}
        </div>
        {saved !== undefined ? <SaveButton kind="worker" id={worker.id} initial={saved} label={fullName} variant="ghost" className="-mr-2 -mt-1.5 shrink-0" /> : null}
      </div>
      <PlaceLine text={place(worker, worker.remote_ok)} />

      <OpenButton open={open} loading={open && data.phase === "loading"} controls={panelId} onClick={toggle} />

      {open ? (
        <div id={panelId} className="mt-3 space-y-4 rounded-xl bg-secondary/60 p-3 sm:p-4" data-ai-card-details>
          <dl className="space-y-3">
            <Row icon={<MapPin />} label={t("easy.listing.location")}>
              {place(worker, worker.remote_ok)}
            </Row>
            <Row icon={<BriefcaseBusiness />} label={t("easy.listing.experience")}>
              {exp ? t(`easy.worker.exp.${exp}`) : "—"}
            </Row>
            {worker.salary_expected ? (
              <Row icon={<Wallet />} label={t("easy.listing.salary")}>
                {formatMoney(worker.salary_expected, locale)}
                <span className="font-normal text-muted-foreground">{tEnum("salary_type_suffix", "monthly")}</span>
              </Row>
            ) : null}
          </dl>
          {worker.about ? (
            <section className="space-y-1">
              <h4 className="text-sm font-bold">{t("easy.listing.about")}</h4>
              <p className="whitespace-pre-line break-words text-base">{worker.about}</p>
            </section>
          ) : null}
          {data.phase === "ready" ? (
            <PhoneBlock kind="worker" id={worker.id} phone={data.phone} signedIn={data.signedIn} next={`/listing/${worker.id}`} />
          ) : data.phase === "error" ? (
            <LoadError onRetry={load} />
          ) : (
            <p className="flex items-center gap-2 text-base text-muted-foreground">
              <Loader2 className="size-5 animate-spin" aria-hidden /> {t("easy.aicard.loading")}
            </p>
          )}
          <Link href={`/listing/${worker.id}`} className="flex min-h-11 items-center justify-center gap-1 border-t border-border pt-2 text-sm font-semibold text-primary-ink hover:underline">
            {t("easy.aicard.open_page")} <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
      ) : null}
    </article>
  );
}
