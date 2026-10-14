"use client";

import Link from "next/link";
import { BriefcaseBusiness, ChevronRight, Phone, Send } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { formatDate, formatMoney, formatPhone, postedDay } from "@/lib/format";
import { ProfessionImage } from "@/components/shared/profession-image";
import { Photo } from "@/components/shared/photo";
import { vacancyPhotoUrl } from "@/features/post/photo";
import { SalaryText } from "@/components/shared/salary-text";
import { levelToExperience } from "@/features/post/types";
import type { Enums } from "@/types/database.types";
import { cn } from "@/lib/utils";
import { isCityRegion } from "@/lib/geo/city";
import { SaveButton } from "@/features/saved/components/save-button";
import { CategoryIcon } from "@/components/shared/category-icon";

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
  /** joylangan vaqt (kartada "Bugun" / "Kecha" / sana) */
  published_at?: string | null;
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

export function usePlace() {
  const { t, name } = useT();
  return (r: PlaceNames, remote: boolean) => {
    if (remote && !r.region_name_uz) return t("easy.search.remote");
    const region = r.region_name_uz ? name({ name_uz: r.region_name_uz, name_ru: r.region_name_ru ?? r.region_name_uz, name_en: r.region_name_en, name_oz: r.region_name_oz }) : null;
    const district = r.district_name_uz ? name({ name_uz: r.district_name_uz, name_ru: r.district_name_ru ?? r.district_name_uz, name_en: r.district_name_en, name_oz: r.district_name_oz }) : null;
    if (!region) return remote ? t("easy.search.remote") : "—";
    // tuman ko'rsatilmagan e'lon — "Butun viloyat" (shaharda — "Butun shahar") deb ochiq yoziladi (aniq tuman natijasi sifatida yashirilmaydi)
    return `${region} · ${district ?? t(isCityRegion({ name_uz: r.region_name_uz }) ? "easy.card.city_wide" : "easy.card.region_wide")}`;
  };
}

/** Katta "Qo'ng'iroq qilish" (tel:, brend rangi) + raqam — ishchi e'loni sahifasidagi bog'lanish bo'limi uchun */
export function CallBlock({ phone, className }: { phone: string; className?: string }) {
  const { t } = useT();
  return (
    <div className={cn("space-y-2", className)}>
      <a
        href={`tel:${phone.replace(/[^\d+]/g, "")}`}
        className="press flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-lg font-bold text-primary-foreground shadow-sm hover:bg-primary-hover"
      >
        <Phone className="size-6" aria-hidden /> {t("easy.card.call")}
      </a>
      <p className="text-center text-lg font-semibold tabular">{formatPhone(phone)}</p>
    </div>
  );
}

/** "Bugun" / "Kecha" / "12-oktabr" — Toshkent vaqti bo'yicha (kartadagi e'lon sanasi) */
function usePosted() {
  const { t, locale } = useT();
  return (iso: string | null | undefined) => {
    if (!iso) return null;
    const rel = postedDay(iso);
    return rel === "today" ? t("common.labels.today") : rel === "yesterday" ? t("common.labels.yesterday") : formatDate(iso, locale, "d MMM");
  };
}

// Karta ixcham (H1): bitta ekranga 3–4 ta e'lon. Butun karta bosiladi — sarlavha havolasi kartani to'liq qoplaydi
// (`after:inset-0`), "Saqlash" va amal tugmasi uning ustida (`relative z-10`) — pastki qatorda chapda, matn ustuni keng qolsin
// (maosh bir qatorga sig'adi). Batafsil matn — e'lon sahifasida.
const cardCls = "relative rounded-2xl border border-border bg-card p-3 shadow-sm transition-colors hover:border-primary/50 sm:p-4";
const stretched = "after:absolute after:inset-0 after:rounded-2xl after:content-[''] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring";
const thumbCls = "size-12 shrink-0 rounded-xl";
const pillCls = "press relative z-10 inline-flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl bg-primary px-3.5 text-base font-bold text-primary-foreground shadow-sm hover:bg-primary-hover";
// pastki qator bitta qatorda: joy yetmasa — jadval yozuvi qisqaradi ("Erkin gr…"), tugmalar va sana doim to'liq
const chipCls = "min-w-0 truncate rounded-lg bg-secondary px-2 py-1 text-sm font-medium text-foreground/80";

/** Kartaning asosiy amali (kichik): raqam bo'lsa — "Qo'ng'iroq qilish", bo'lmasa — "Ariza yuborish" / "Bog'lanish" (G3) */
function CardAction({ phone, action }: { phone: string | null; action: { href: string; label: string } }) {
  const { t } = useT();
  if (phone) {
    return (
      <a href={`tel:${phone.replace(/[^\d+]/g, "")}`} className={pillCls} aria-label={`${t("easy.card.call")}: ${formatPhone(phone)}`} title={formatPhone(phone)}>
        <Phone className="size-4" aria-hidden /> {t("easy.card.call_short")}
      </a>
    );
  }
  return (
    // "Batafsil" (sarlavha) o'sha sahifani oldindan yuklaydi — ikkinchi prefetch ro'yxatda asosiy oqimni band qilmasin
    <Link href={action.href} prefetch={false} className={pillCls}>
      <Send className="size-4" aria-hidden /> {action.label}
    </Link>
  );
}

/** `saved` berilsa — "Saqlash" belgisi (holati bilan); berilmasa — belgi yo'q (holati noma'lum joylarda adashtirmasin) */
export function JobResultCard({ job, imageUrl, photoPath, saved, savedRefresh }: { job: JobCardData; imageUrl?: string | null; photoPath?: string | null; saved?: boolean; savedRefresh?: boolean }) {
  const { t, tEnum, name } = useT();
  const place = usePlace();
  const posted = usePosted();
  const profession = job.profession_name_uz ? name({ name_uz: job.profession_name_uz, name_ru: job.profession_name_ru ?? job.profession_name_uz, name_en: job.profession_name_en }) : job.title;
  const when = posted(job.published_at);
  return (
    <article className={cardCls}>
      <div className="flex gap-3">
        {/* haqiqiy ish joyi surati (egasi yuklagan, moderatsiyadan o'tgan); ochilmasa — kasb tasviri */}
        <Photo
          src={photoPath ? vacancyPhotoUrl(photoPath) : null}
          alt={t("easy.photo.alt")}
          sizes="56px"
          className={thumbCls}
          fallback={<ProfessionImage url={imageUrl} icon={job.category_icon} name={profession} className={thumbCls} iconClassName="size-6" />}
        />
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 break-words text-lg font-bold leading-snug">
            <Link href={`/jobs/${job.slug}`} className={stretched}>
              {job.title}
            </Link>
          </h3>
          <SalaryText from={job.salary_from} to={job.salary_to} type={job.salary_type} negotiable={job.salary_negotiable} className="mt-0.5 block text-base font-bold text-primary" />
          {/* joy birinchi (ish izlovchi uchun muhimroq) — uzun kompaniya nomi tumanni kesib tashlamasin */}
          <p className="mt-0.5 truncate text-sm text-muted-foreground">
            {place(job, job.is_remote)}
            {job.employer_name ? ` · ${job.employer_name}` : ""}
          </p>
        </div>
      </div>
      {/* amallar chapda (o'ngdagi lupa tugmasi ularni yopmasin), sana — o'ng chetda */}
      <div className="mt-2 flex items-center gap-2">
        <CardAction phone={job.phone} action={{ href: `/jobs/${job.slug}?apply=1`, label: t("easy.card.apply") }} />
        {saved !== undefined ? <SaveButton kind="vacancy" id={job.id} initial={saved} label={job.title} refresh={savedRefresh} className="relative z-10" /> : null}
        {job.is_featured ? <span className="shrink-0 rounded-lg bg-warning px-2 py-1 text-sm font-bold text-warning-foreground">{t("easy.card.featured")}</span> : null}
        {job.schedule !== "negotiable" ? <span className={chipCls}>{tEnum("work_schedule", job.schedule)}</span> : null}
        {when ? (
          <span className="ml-auto shrink-0 whitespace-nowrap text-sm text-muted-foreground" suppressHydrationWarning>
            {when}
          </span>
        ) : null}
      </div>
    </article>
  );
}

export function WorkerResultCard({ worker, imageUrl, saved, savedRefresh }: { worker: WorkerCardData; imageUrl?: string | null; saved?: boolean; savedRefresh?: boolean }) {
  const { t, name, locale } = useT();
  const place = usePlace();
  const profession = worker.profession_name_uz
    ? name({ name_uz: worker.profession_name_uz, name_ru: worker.profession_name_ru ?? worker.profession_name_uz, name_en: worker.profession_name_en })
    : (worker.headline ?? "");
  const exp = levelToExperience(worker.experience_level);
  const expValue = exp ? t(`easy.worker.exp.${exp}`) : "—";
  const expText = t("easy.card.experience", { value: expValue });
  const fullName = `${worker.first_name}${worker.last_initial ? ` ${worker.last_initial}.` : ""}`;
  return (
    <article className={cardCls}>
      <div className="flex gap-3">
        {/* haqiqiy surat (egasi yuklagan); ochilmasa — kasb tasviri */}
        <Photo
          src={worker.avatar_url}
          alt={fullName}
          sizes="56px"
          className={thumbCls}
          fallback={<ProfessionImage url={imageUrl} icon={worker.category_icon} name={profession} className={thumbCls} iconClassName="size-6" />}
        />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-lg font-bold leading-snug">
            <Link href={`/listing/${worker.id}`} className={stretched}>
              {fullName}
            </Link>
          </h3>
          <p className="truncate text-base font-semibold text-primary">{profession}</p>
          <p className="mt-0.5 truncate text-sm text-muted-foreground">
            {place(worker, false)}
            {worker.remote_ok ? ` · ${t("easy.card.remote")}` : ""}
          </p>
          {worker.salary_expected ? <p className="truncate text-sm font-semibold">{t("easy.card.salary_expected", { amount: formatMoney(worker.salary_expected, locale) })}</p> : null}
        </div>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <CardAction phone={worker.phone} action={{ href: `/listing/${worker.id}#contact`, label: t("easy.card.contact") }} />
        {saved !== undefined ? <SaveButton kind="worker" id={worker.id} initial={saved} label={fullName} refresh={savedRefresh} className="relative z-10" /> : null}
        {/* qisqa: ikonka + qiymat (pastki qator bitta qatorga sig'sin); to'liq "Tajriba: …" — ekran o'qigichi uchun */}
        <span className={cn(chipCls, "flex items-center gap-1")} title={expText}>
          <BriefcaseBusiness className="size-4 shrink-0 text-primary" aria-hidden />
          <span className="sr-only">{expText}</span>
          <span className="truncate" aria-hidden>
            {expValue}
          </span>
        </span>
      </div>
    </article>
  );
}

const compactRow = "press flex min-h-16 items-center gap-3 rounded-2xl border border-border bg-card px-3 py-2.5 hover:border-primary/50";

/** Ixcham qator (qidiruv boshidagi "Yangi e'lonlar"): nomi, maosh, joy — bosilsa e'lon sahifasi */
export function JobCompactRow({ job }: { job: JobCardData }) {
  const place = usePlace();
  return (
    <Link href={`/jobs/${job.slug}`} className={compactRow}>
      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary" aria-hidden>
        <CategoryIcon name={job.category_icon} className="size-6" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-lg font-bold leading-snug">{job.title}</span>
        <SalaryText from={job.salary_from} to={job.salary_to} type={job.salary_type} negotiable={job.salary_negotiable} className="block truncate text-base" />
        <span className="block truncate text-sm text-muted-foreground">{place(job, job.is_remote)}</span>
      </span>
      <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
    </Link>
  );
}

export function WorkerCompactRow({ worker }: { worker: WorkerCardData }) {
  const { t, name } = useT();
  const place = usePlace();
  const profession = worker.profession_name_uz
    ? name({ name_uz: worker.profession_name_uz, name_ru: worker.profession_name_ru ?? worker.profession_name_uz, name_en: worker.profession_name_en })
    : (worker.headline ?? "");
  const exp = levelToExperience(worker.experience_level);
  return (
    <Link href={`/listing/${worker.id}`} className={compactRow}>
      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary" aria-hidden>
        <CategoryIcon name={worker.category_icon} className="size-6" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-lg font-bold leading-snug">
          {worker.first_name}
          {worker.last_initial ? ` ${worker.last_initial}.` : ""} · <span className="text-primary">{profession}</span>
        </span>
        <span className="block truncate text-base">{t("easy.card.experience", { value: exp ? t(`easy.worker.exp.${exp}`) : "—" })}</span>
        <span className="block truncate text-sm text-muted-foreground">{place(worker, false)}</span>
      </span>
      <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
    </Link>
  );
}
