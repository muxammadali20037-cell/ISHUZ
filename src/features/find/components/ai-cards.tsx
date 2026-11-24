"use client";

import Link from "next/link";
import { ArrowRight, BadgeCheck, MapPin } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import { SalaryText } from "@/components/shared/salary-text";
import { SaveButton } from "@/features/saved/components/save-button";
import { OrgMark, usePlace, type JobCardData, type WorkerCardData } from "./result-cards";

/**
 * Yordamchi (AI) javobidagi va bosh sahifadagi kartalar: lavozim (yoki ism va kasb) · maosh · ish beruvchi · joy →
 * "Ko'rish →" (o'ng tomonda). Ega (2026-11-24): "ochishni boshqacha qilish kerak" — tanlovi "Alohida sahifa": tugma e'lonning o'z sahifasini
 * ochadi (vakansiya — /jobs/<slug>, ishchi — /listing/<id>); u yerda hamma ma'lumot, telefon va ariza. Orqaga — ro'yxatga.
 * Avvalgi "kartaning o'zida ochilish" (2026-11-19) olib tashlandi.
 */

// oq, sokin karta (ega, 2026-11-21: "ranglar yemagan, bolalarcha") — rang faqat muhim joyda (maosh, tugma)
const cardCls = "relative rounded-2xl border border-border bg-card p-4 shadow-sm";
// ega (2026-11-24): "Ko'rish →" (o'ng tomonda) — kichik, ko'k shaffof shisha (.glass-blue): ichi to'la rang emas, to'rt tomondan soya,
// burchaklardan ozgina nur. Ko'rinishi 36px; bosiladigan joy — 44px (::after, a11y)
const openBtnCls =
  "glass-blue press relative mt-3 inline-flex h-9 items-center justify-center gap-1.5 rounded-xl px-3.5 text-sm font-semibold text-primary-ink transition-[transform,box-shadow,background-color] hover:-translate-y-px after:absolute after:inset-x-0 after:-inset-y-1 after:content-[''] disabled:opacity-70";

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

/** "Ko'rish →" — e'lonning o'z sahifasi (ko'k shaffof shisha, .glass-blue); kartaning o'ng tomonida (ega, 2026-11-24) */
function OpenLink({ href }: { href: string }) {
  const { t } = useT();
  return (
    <div className="flex justify-end">
      <Link href={href} className={openBtnCls} data-ai-card-open>
        {t("easy.aicard.open")} <ArrowRight className="size-4" aria-hidden />
      </Link>
    </div>
  );
}

export function AiJobCard({ job, saved, image }: { job: JobCardData; saved?: boolean; image?: CardImage | null }) {
  const { t } = useT();
  const place = usePlace();
  const negotiable = job.salary_negotiable || (!job.salary_from && !job.salary_to);
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
      <OpenLink href={`/jobs/${job.slug}`} />
    </article>
  );
}

export function AiWorkerCard({ worker, saved, image }: { worker: WorkerCardData; saved?: boolean; image?: CardImage | null }) {
  const { name } = useT();
  const place = usePlace();
  const profession = worker.profession_name_uz
    ? name({ name_uz: worker.profession_name_uz, name_ru: worker.profession_name_ru ?? worker.profession_name_uz, name_en: worker.profession_name_en })
    : (worker.headline ?? "");
  const fullName = `${worker.first_name}${worker.last_initial ? ` ${worker.last_initial}.` : ""}`;
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
      <OpenLink href={`/listing/${worker.id}`} />
    </article>
  );
}
