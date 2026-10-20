"use client";

import Link from "next/link";
import { BadgeCheck, BriefcaseBusiness, CheckCircle2, ChevronRight, Clock, MapPin, Phone, Send, Wallet } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { formatDate, formatMoney, formatPhone, postedDay } from "@/lib/format";
import { ProfessionImage } from "@/components/shared/profession-image";
import { Photo } from "@/components/shared/photo";
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

/**
 * Kartadagi qisqa joy (bitta qatorga sig'sin): eng aniq qismi — tuman — birinchi, joy yetmasa viloyat nomi qisqaradi;
 * Toshkent shahrida faqat tuman. To'liq joy (usePlace) — title va ekran o'qigichi uchun.
 */
export function useShortPlace() {
  const { t, name } = useT();
  return (r: PlaceNames, remote: boolean) => {
    if (remote && !r.region_name_uz) return t("easy.search.remote");
    const region = r.region_name_uz ? name({ name_uz: r.region_name_uz, name_ru: r.region_name_ru ?? r.region_name_uz, name_en: r.region_name_en, name_oz: r.region_name_oz }) : null;
    const district = r.district_name_uz ? name({ name_uz: r.district_name_uz, name_ru: r.district_name_ru ?? r.district_name_uz, name_en: r.district_name_en, name_oz: r.district_name_oz }) : null;
    if (!region) return remote ? t("easy.search.remote") : "—";
    if (!district) return region;
    return isCityRegion({ name_uz: r.region_name_uz }) ? district : `${district} · ${region}`;
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

// Karta (2026-10 redizayn, COBALT SUN): matn birinchi — lavozim → maosh va davri → kompaniya → hudud · grafik · tajriba →
// sana va amal. Butun karta bosiladi (sarlavha havolasi kartani qoplaydi, `after:inset-0`); "Saqlash" — o'ng yuqori burchakda,
// amal tugmasi — pastki qatorda (ikkalasi `relative z-10`, karta havolasi ustida). Katta rasm va rangli belgilar yo'q.
const cardCls = "relative rounded-xl border border-border bg-card px-4 py-3 transition-colors hover:border-primary/40 focus-within:border-primary/60";
const stretched = "after:absolute after:inset-0 after:rounded-xl after:content-[''] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring";
const thumbCls = "size-12 shrink-0 rounded-lg";
// amal: ikkilamchi (kartada bitta asosiy narsa — ma'lumot), lekin bosish maydoni ≥ 44 px
const actionCls = "press relative z-10 inline-flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-primary/30 bg-card px-3 text-base font-semibold text-primary hover:border-primary hover:bg-primary-soft";
const metaCls = "flex shrink-0 items-center gap-1";
const chipCls = "min-w-0 truncate rounded-md bg-secondary px-2 py-1 text-sm font-medium text-foreground/80";
// o'z arizasi holati (ariza tugmasi o'rnida): bosilsa — "Arizalarim"
const appliedCls = "press relative z-10 inline-flex min-h-11 min-w-0 items-center gap-1.5 rounded-lg bg-success-soft px-3 text-sm font-bold text-success hover:bg-success-soft/70";
const saveCls = "absolute right-1.5 top-1.5 z-10";

/** Kartaning amali (kichik, ikkilamchi): raqam bo'lsa — "Qo'ng'iroq", bo'lmasa — "Ariza yuborish" / "Bog'lanish" (G3) */
function CardAction({ phone, action }: { phone: string | null; action: { href: string; label: string } }) {
  const { t } = useT();
  if (phone) {
    return (
      <a href={`tel:${phone.replace(/[^\d+]/g, "")}`} className={actionCls} aria-label={`${t("easy.card.call")}: ${formatPhone(phone)}`} title={formatPhone(phone)}>
        <Phone className="size-4" aria-hidden /> {t("easy.card.call_short")}
      </a>
    );
  }
  return (
    // e'lon sahifasi sarlavha orqali oldindan yuklanadi — ikkinchi prefetch ro'yxatda asosiy oqimni band qilmasin
    <Link href={action.href} prefetch={false} className={actionCls}>
      <Send className="size-4" aria-hidden /> {action.label}
    </Link>
  );
}

/** Kompaniya belgisi: haqiqiy logotip bo'lmasa — bosh harf (neytral), soxta logotip yo'q */
function OrgMark({ name }: { name: string }) {
  return (
    <span className="flex size-5 shrink-0 items-center justify-center rounded bg-secondary text-2xs font-bold uppercase text-foreground/70" aria-hidden>
      {name.trim().slice(0, 1)}
    </span>
  );
}

const EXP_STEPS = [60, 36, 24, 12, 6] as const;

/**
 * Vakansiya kartasi: lavozim (2 qatorgacha) → maosh va to'lov davri → kompaniya (faqat haqiqatan tasdiqlangan bo'lsa — belgi) →
 * hudud · grafik · tajriba → sana (TOP bo'lsa — sariq belgi) va amal. `saved` berilsa — "Saqlash" (holati bilan); berilmasa — yo'q
 * (holati noma'lum joylarda adashtirmasin). `applied` — o'z arizasi holati: "Ariza yuborish" o'rniga holat. `imageUrl`/`photoPath` —
 * ro'yxatda ko'rsatilmaydi (matn muhim); e'lon sahifasida ko'rinadi.
 */
export function JobResultCard({
  job,
  saved,
  savedRefresh,
  applied,
}: {
  job: JobCardData;
  imageUrl?: string | null;
  photoPath?: string | null;
  saved?: boolean;
  savedRefresh?: boolean;
  applied?: Enums<"application_status"> | null;
}) {
  const { t, tEnum } = useT();
  const place = usePlace();
  const shortPlace = useShortPlace();
  const posted = usePosted();
  const when = posted(job.published_at);
  const step = EXP_STEPS.find((m) => job.experience_min_months >= m);
  const expValue = tEnum("experience_min_months", String(step ?? 6));
  const experience = job.experience_min_months === 0 ? t("easy.card.no_experience") : t("easy.card.experience", { value: expValue });
  const schedule = job.schedule !== "negotiable" ? tEnum("work_schedule", job.schedule) : null;
  const where = place(job, job.is_remote);
  return (
    <article className={cardCls}>
      <h3 className={cn("line-clamp-2 break-words text-lg font-bold leading-snug", saved !== undefined && "pr-10")}>
        <Link href={`/jobs/${job.slug}`} className={stretched}>
          {job.title}
        </Link>
      </h3>
      <SalaryText
        from={job.salary_from}
        to={job.salary_to}
        type={job.salary_type}
        negotiable={job.salary_negotiable}
        className={cn("mt-0.5 block text-base font-bold", job.salary_negotiable || (!job.salary_from && !job.salary_to) ? "text-muted-foreground" : "text-foreground")}
      />
      {job.employer_name ? (
        <p className="mt-1 flex min-w-0 items-center gap-1.5 text-sm font-medium text-foreground/85">
          <OrgMark name={job.employer_name} />
          <span className="truncate">{job.employer_name}</span>
          {/* faqat moderator tasdiqlagan kompaniya (companies.verification_status = verified) */}
          {job.employer_verified ? <BadgeCheck className="size-4 shrink-0 text-primary" role="img" aria-label={t("jobs.detail.company_verified")} /> : null}
        </p>
      ) : null}
      {/* bitta qator: hudud (qisqa: tuman birinchi; to'liq — title va ekran o'qigichida) · grafik · tajriba */}
      <ul className="mt-1 flex min-w-0 items-center gap-x-3 text-sm text-muted-foreground">
        <li className="flex min-w-0 items-center gap-1" title={where}>
          <MapPin className="size-4 shrink-0" aria-hidden />
          <span className="truncate" aria-hidden>
            {shortPlace(job, job.is_remote)}
          </span>
          <span className="sr-only">{where}</span>
        </li>
        {schedule ? (
          <li className={metaCls}>
            <Clock className="size-4 shrink-0" aria-hidden />
            <span className="whitespace-nowrap">{schedule}</span>
          </li>
        ) : null}
        <li className={metaCls} title={experience}>
          <BriefcaseBusiness className="size-4 shrink-0" aria-hidden />
          {job.experience_min_months === 0 ? (
            <span className="whitespace-nowrap">{experience}</span>
          ) : (
            <>
              <span className="sr-only">{experience}</span>
              <span className="whitespace-nowrap" aria-hidden>
                {expValue}
              </span>
            </>
          )}
        </li>
      </ul>
      <div className="mt-2 flex items-center gap-2">
        {job.is_featured ? <span className="shrink-0 rounded bg-highlight px-1.5 py-0.5 text-xs font-bold text-highlight-foreground">{t("easy.card.featured")}</span> : null}
        {when ? (
          <span className="min-w-0 truncate text-sm text-muted-foreground" suppressHydrationWarning>
            {when}
          </span>
        ) : null}
        <span className="ml-auto flex min-w-0 items-center gap-2">
          {applied ? (
            <>
              {job.phone ? <CardAction phone={job.phone} action={{ href: `/jobs/${job.slug}`, label: t("easy.card.apply") }} /> : null}
              <Link href="/applications" prefetch={false} className={appliedCls}>
                <CheckCircle2 className="size-4 shrink-0" aria-hidden />
                <span className="truncate">{t("easy.card.applied_status", { status: tEnum("application_status", applied) })}</span>
              </Link>
            </>
          ) : (
            <CardAction phone={job.phone} action={{ href: `/jobs/${job.slug}?apply=1`, label: t("easy.card.apply") }} />
          )}
        </span>
      </div>
      {saved !== undefined ? <SaveButton kind="vacancy" id={job.id} initial={saved} label={job.title} refresh={savedRefresh} variant="ghost" className={saveCls} /> : null}
    </article>
  );
}

export function WorkerResultCard({ worker, imageUrl, saved, savedRefresh }: { worker: WorkerCardData; imageUrl?: string | null; saved?: boolean; savedRefresh?: boolean }) {
  const { t, tEnum, name, locale } = useT();
  const place = usePlace();
  const profession = worker.profession_name_uz
    ? name({ name_uz: worker.profession_name_uz, name_ru: worker.profession_name_ru ?? worker.profession_name_uz, name_en: worker.profession_name_en })
    : (worker.headline ?? "");
  const exp = levelToExperience(worker.experience_level);
  const expText = t("easy.card.experience", { value: exp ? t(`easy.worker.exp.${exp}`) : "—" });
  const salaryAmount = worker.salary_expected ? formatMoney(worker.salary_expected, locale) : "";
  const salarySuffix = tEnum("salary_type_suffix", "monthly");
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
          {salaryAmount ? (
            // ikonka + summa: "Желаемая зарплата: …" kabi uzun yozuv summani kesib qo'ymasin; to'liq matn — ekran o'qigichi uchun
            <p className="flex min-w-0 items-center gap-1 text-sm font-semibold" title={`${t("easy.card.salary_expected", { amount: salaryAmount })}${salarySuffix}`}>
              <Wallet className="size-4 shrink-0 text-primary" aria-hidden />
              <span className="sr-only">
                {t("easy.card.salary_expected", { amount: salaryAmount })}
                {salarySuffix}
              </span>
              <span className="truncate tabular" aria-hidden>
                {salaryAmount}
                <span className="font-normal text-muted-foreground">{salarySuffix}</span>
              </span>
            </p>
          ) : null}
        </div>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <CardAction phone={worker.phone} action={{ href: `/listing/${worker.id}#contact`, label: t("easy.card.contact") }} />
        {saved !== undefined ? <SaveButton kind="worker" id={worker.id} initial={saved} label={fullName} refresh={savedRefresh} className="relative z-10" /> : null}
        {/* qisqa: ikonka + "3+ yil" (pastki qator bitta qatorga sig'sin, ru/en da ham); to'liq "Tajriba: …" — ekran o'qigichi uchun */}
        <span className={cn(chipCls, "flex items-center gap-1")} title={expText}>
          <BriefcaseBusiness className="size-4 shrink-0 text-primary" aria-hidden />
          <span className="sr-only">{expText}</span>
          <span className="truncate" aria-hidden>
            {exp ? t(`easy.card.exp_short.${exp}`) : "—"}
          </span>
        </span>
      </div>
    </article>
  );
}

const compactRow = "press flex min-h-16 items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5 hover:border-primary/40";

/** Ixcham qator (qidiruv boshidagi "Yangi e'lonlar"): nomi, maosh, joy — bosilsa e'lon sahifasi */
export function JobCompactRow({ job }: { job: JobCardData }) {
  const place = usePlace();
  return (
    <Link href={`/jobs/${job.slug}`} className={compactRow}>
      <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary" aria-hidden>
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
      <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary" aria-hidden>
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
