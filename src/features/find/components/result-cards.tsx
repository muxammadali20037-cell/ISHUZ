"use client";

import Link from "next/link";
import { BriefcaseBusiness, Clock, MapPin, Phone } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { formatMoney, formatPhone } from "@/lib/format";
import { ProfessionImage } from "@/components/shared/profession-image";
import { vacancyPhotoUrl } from "@/features/post/photo";
import { SalaryText } from "@/components/shared/salary-text";
import { levelToExperience } from "@/features/post/types";
import type { Enums } from "@/types/database.types";
import { cn } from "@/lib/utils";

interface PlaceNames {
  region_name_uz: string | null;
  region_name_ru: string | null;
  region_name_en: string | null;
  region_name_oz: string | null;
  district_name_uz: string | null;
  district_name_ru: string | null;
  district_name_en: string | null;
  district_name_oz: string | null;
}

export interface JobCardData extends PlaceNames {
  id: string;
  slug: string;
  title: string;
  employer_name: string | null;
  employer_verified: boolean;
  profession_node_id: string | null;
  profession_name_uz: string | null;
  profession_name_ru: string | null;
  profession_name_en: string | null;
  category_slug: string | null;
  category_icon: string | null;
  region_wide: boolean;
  is_remote: boolean;
  salary_from: number | null;
  salary_to: number | null;
  salary_type: Enums<"salary_type">;
  salary_negotiable: boolean;
  schedule: Enums<"work_schedule">;
  experience_min_months: number;
  summary: string | null;
  phone: string | null;
  is_featured: boolean;
}

export interface WorkerCardData extends PlaceNames {
  id: string;
  first_name: string;
  last_initial: string | null;
  avatar_url: string | null;
  headline: string | null;
  profession_node_id: string | null;
  profession_name_uz: string | null;
  profession_name_ru: string | null;
  profession_name_en: string | null;
  category_slug: string | null;
  category_icon: string | null;
  about: string | null;
  region_wide: boolean;
  remote_ok: boolean;
  experience_level: Enums<"experience_level">;
  salary_expected: number | null;
  phone: string | null;
}

function usePlace() {
  const { t, name } = useT();
  return (r: PlaceNames, remote: boolean) => {
    if (remote && !r.region_name_uz) return t("easy.search.remote");
    const region = r.region_name_uz ? name({ name_uz: r.region_name_uz, name_ru: r.region_name_ru ?? r.region_name_uz, name_en: r.region_name_en, name_oz: r.region_name_oz }) : null;
    const district = r.district_name_uz ? name({ name_uz: r.district_name_uz, name_ru: r.district_name_ru ?? r.district_name_uz, name_en: r.district_name_en, name_oz: r.district_name_oz }) : null;
    if (!region) return remote ? t("easy.search.remote") : "—";
    // tuman ko'rsatilmagan e'lon — "Butun viloyat" deb ochiq yoziladi (aniq tuman natijasi sifatida yashirilmaydi)
    return `${region} · ${district ?? t("easy.card.region_wide")}`;
  };
}

/** Katta yashil "Qo'ng'iroq qilish" (tel:) + raqam; raqam bo'lmasa — tushuntirish */
export function CallBlock({ phone, detailsHref, className }: { phone: string | null; detailsHref?: string; className?: string }) {
  const { t } = useT();
  return (
    <div className={cn("space-y-2", className)}>
      {phone ? (
        <>
          <a
            href={`tel:${phone.replace(/[^\d+]/g, "")}`}
            className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-success px-4 text-lg font-bold text-success-foreground shadow-sm transition-opacity hover:opacity-90"
          >
            <Phone className="size-6" aria-hidden /> {t("easy.card.call")}
          </a>
          <p className="text-center text-lg font-semibold tabular">{formatPhone(phone)}</p>
        </>
      ) : (
        detailsHref ? <p className="rounded-xl bg-secondary px-3 py-2 text-base text-muted-foreground">{t("easy.card.no_phone")}</p> : null
      )}
      {detailsHref ? (
        <Link href={detailsHref} className="flex min-h-12 w-full items-center justify-center rounded-2xl border-2 border-primary/40 px-4 text-lg font-semibold text-primary hover:bg-primary-soft/50">
          {t("easy.card.details")}
        </Link>
      ) : null}
    </div>
  );
}

export function JobResultCard({ job, imageUrl, photoPath }: { job: JobCardData; imageUrl?: string | null; photoPath?: string | null }) {
  const { t, tEnum, name } = useT();
  const place = usePlace();
  const profession = job.profession_name_uz ? name({ name_uz: job.profession_name_uz, name_ru: job.profession_name_ru ?? job.profession_name_uz, name_en: job.profession_name_en }) : job.title;
  return (
    <article className="flex flex-col gap-4 rounded-3xl border border-border bg-card p-4 shadow-sm sm:p-5">
      <div className="flex gap-4">
        {photoPath ? (
          <figure className="relative w-24 shrink-0 sm:w-32">
            {/* haqiqiy ish joyi surati (egasi yuklagan, moderatsiyadan o'tgan) */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={vacancyPhotoUrl(photoPath) ?? ""} alt={t("easy.photo.alt")} loading="lazy" className="aspect-[4/3] w-full rounded-2xl object-cover" />
            <figcaption className="absolute bottom-1 left-1 rounded-md bg-black/60 px-1.5 py-0.5 text-[11px] font-semibold text-white">{t("easy.photo.label")}</figcaption>
          </figure>
        ) : (
          <ProfessionImage url={imageUrl} categorySlug={job.category_slug} icon={job.category_icon} name={profession} label={imageUrl ? t("easy.image.label") : undefined} className="aspect-[4/3] w-24 shrink-0 sm:w-32" />
        )}
        <div className="min-w-0 flex-1">
          {job.is_featured ? <span className="mb-1 inline-block rounded-md bg-warning px-1.5 py-0.5 text-xs font-bold text-warning-foreground">{t("easy.card.featured")}</span> : null}
          <h3 className="break-words text-xl font-bold leading-snug">{job.title}</h3>
          {job.employer_name ? <p className="mt-0.5 text-base font-medium text-muted-foreground">{job.employer_name}</p> : null}
        </div>
      </div>
      <ul className="space-y-1.5 text-lg">
        <li className="flex items-start gap-2">
          <MapPin className="mt-1 size-5 shrink-0 text-primary" aria-hidden />
          <span>{place(job, job.is_remote)}</span>
        </li>
        <li className="flex items-start gap-2">
          <BriefcaseBusiness className="mt-1 size-5 shrink-0 text-primary" aria-hidden />
          <SalaryText from={job.salary_from} to={job.salary_to} type={job.salary_type} negotiable={job.salary_negotiable} className="text-lg" />
        </li>
        {job.schedule !== "negotiable" ? (
          <li className="flex items-start gap-2">
            <Clock className="mt-1 size-5 shrink-0 text-primary" aria-hidden />
            <span>{tEnum("work_schedule", job.schedule)}</span>
          </li>
        ) : null}
      </ul>
      {job.summary ? <p className="line-clamp-3 text-base text-foreground/80">{job.summary}</p> : null}
      <CallBlock phone={job.phone} detailsHref={`/jobs/${job.slug}`} />
    </article>
  );
}

export function WorkerResultCard({ worker, imageUrl }: { worker: WorkerCardData; imageUrl?: string | null }) {
  const { t, name, locale } = useT();
  const place = usePlace();
  const profession = worker.profession_name_uz
    ? name({ name_uz: worker.profession_name_uz, name_ru: worker.profession_name_ru ?? worker.profession_name_uz, name_en: worker.profession_name_en })
    : (worker.headline ?? "");
  const exp = levelToExperience(worker.experience_level);
  const fullName = `${worker.first_name}${worker.last_initial ? ` ${worker.last_initial}.` : ""}`;
  return (
    <article className="flex flex-col gap-4 rounded-3xl border border-border bg-card p-4 shadow-sm sm:p-5">
      <div className="flex gap-4">
        {worker.avatar_url ? (
          // haqiqiy surat (egasi yuklagan)
          // eslint-disable-next-line @next/next/no-img-element
          <img src={worker.avatar_url} alt={fullName} loading="lazy" className="aspect-[4/3] w-24 shrink-0 rounded-2xl object-cover sm:w-32" />
        ) : (
          <ProfessionImage url={imageUrl} categorySlug={worker.category_slug} icon={worker.category_icon} name={profession} label={imageUrl ? t("easy.image.label") : undefined} className="aspect-[4/3] w-24 shrink-0 sm:w-32" />
        )}
        <div className="min-w-0 flex-1">
          <h3 className="break-words text-xl font-bold leading-snug">{fullName}</h3>
          <p className="mt-0.5 text-lg font-semibold text-primary">{profession}</p>
        </div>
      </div>
      <ul className="space-y-1.5 text-lg">
        <li className="flex items-start gap-2">
          <MapPin className="mt-1 size-5 shrink-0 text-primary" aria-hidden />
          <span>
            {place(worker, false)}
            {worker.remote_ok ? <span className="text-muted-foreground"> · {t("easy.card.remote")}</span> : null}
          </span>
        </li>
        <li className="flex items-start gap-2">
          <BriefcaseBusiness className="mt-1 size-5 shrink-0 text-primary" aria-hidden />
          <span>{t("easy.card.experience", { value: exp ? t(`easy.worker.exp.${exp}`) : "—" })}</span>
        </li>
        {worker.salary_expected ? <li className="pl-7 text-base text-muted-foreground">{t("easy.card.salary_expected", { amount: formatMoney(worker.salary_expected, locale) })}</li> : null}
      </ul>
      {worker.about ? <p className="line-clamp-3 text-base text-foreground/80">{worker.about}</p> : null}
      <CallBlock phone={worker.phone} detailsHref={`/listing/${worker.id}`} />
    </article>
  );
}
