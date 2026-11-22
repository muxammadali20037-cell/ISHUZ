import { ListingPhoto } from "@/features/listing-image/components/listing-photo";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ChevronLeft, ChevronRight, MapPin, Pencil, Phone } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { formatMoney, formatPhone, telHref } from "@/lib/format";
import { getSession } from "@/features/auth/session";
import { Shell } from "@/components/shared/shell";
import { Button } from "@/components/ui/button";
import { ProfessionImage } from "@/components/shared/profession-image";
import { Photo } from "@/components/shared/photo";
import { CallBlock, LiveStatus } from "@/features/find/components/result-cards";
import { workerStatuses } from "@/features/find/queries";
import { StatusPill } from "@/features/cabinet/components/status-pill";
import { levelToExperience } from "@/features/post/types";
import { getProfessionImages } from "@/lib/profession-images/server";
import { ChatButton, RevealPhone } from "@/features/contacts/reveal-phone";
import { getContactUnlockConfig } from "@/features/contacts/unlock-config";
import { isMissingRelation } from "@/features/saved/missing";
import { isCityRegion } from "@/lib/geo/city";
import { BackLink } from "@/components/shared/back-link";

type Params = { params: Promise<{ id: string }> };

async function load(id: string) {
  if (!z.uuid().safeParse(id).success) return null;
  const supabase = await createClient();
  // 0088: p_phone = false — raqam faqat egasi, admin va raqamni ochgan uchun (sahifani ko'rish raqamni "ochmaydi");
  // 0088 qo'llanmagan baza — avvalgi chaqiruv
  const res = await supabase.rpc("simple_worker_listing", { p_id: id, p_phone: false });
  if (res.error && isMissingRelation(res.error, res.status)) {
    const { data } = await supabase.rpc("simple_worker_listing", { p_id: id });
    return data?.[0] ?? null;
  }
  return res.data?.[0] ?? null;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const { t } = await getT();
  const w = await load(id);
  return { title: w ? `${w.first_name} — ${w.headline ?? t("easy.listing.title")}` : t("easy.listing.not_found"), robots: { index: false } };
}

/** Ish qidiruvchi e'loni (ochiq): kasb, hudud, tajriba, o'zi haqida, ruxsat bo'lsa telefon va "Qo'ng'iroq qilish" */
export default async function ListingPage({ params }: Params) {
  const { id } = await params;
  const [{ t, tEnum, name, locale }, w, session, unlockConfig] = await Promise.all([getT(), load(id), getSession(), getContactUnlockConfig()]);
  if (!w) notFound();
  const [images, statuses] = await Promise.all([getProfessionImages([w.profession_node_id]), workerStatuses([w.id])]);
  const profession = w.profession_name_uz ? name({ name_uz: w.profession_name_uz, name_ru: w.profession_name_ru ?? w.profession_name_uz, name_en: w.profession_name_en }) : (w.headline ?? "");
  const region = w.region_name_uz ? name({ name_uz: w.region_name_uz, name_ru: w.region_name_ru ?? w.region_name_uz, name_en: w.region_name_en, name_oz: w.region_name_oz }) : null;
  const district = w.district_name_uz ? name({ name_uz: w.district_name_uz, name_ru: w.district_name_ru ?? w.district_name_uz, name_en: w.district_name_en, name_oz: w.district_name_oz }) : null;
  const exp = levelToExperience(w.experience_level);
  const fullName = `${w.first_name}${w.last_initial ? ` ${w.last_initial}.` : ""}`;
  const isEmployer = !!session?.employerId;
  const ownPhones = w.is_owner ? [w.phone, w.phone2].filter((p): p is string => !!p) : [];

  return (
    <Shell>
      <div className="container-narrow space-y-3 py-3 text-lg sm:py-8">
        {/* qidiruvdan kelgan bo'lsa — o'sha natijalarga (o'sha joyiga) qaytadi */}
        <BackLink
          pageBack
          fallback={w.is_owner ? "/cabinet" : "/search?mode=workers"}
          className="-ml-1 inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-base font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <ChevronLeft className="size-5" aria-hidden /> {w.is_owner ? t("easy.cabinet.title") : t("easy.wizard.back")}
        </BackLink>

        <ListingPhoto entity="worker" id={w.id} alt={profession} />

        {w.is_owner ? (
          // egasi oynasi (ega, 2026-11-19: "ustiga bossa qo'ng'iroq ketsin, oynani soddalashtir"): holat → e'londagi raqam(lar)
          // (0081: oynada qo'lda yozilgan; har biri — bosilsa qo'ng'iroq) → "E'lonni o'zgartirish" — har biri alohida qator
          <div className="overflow-hidden rounded-2xl border border-border bg-card" data-listing-owner>
            <div className="px-4 pb-1 pt-3">
              <StatusPill size="sm" tone={w.is_listed ? "ok" : "wait"}>{w.is_listed ? t("easy.cabinet.status.listed") : t("easy.cabinet.status.payment_required")}</StatusPill>
            </div>
            {ownPhones.length ? (
              <div className="px-4 pb-1 pt-2" data-listing-own-phones>
                <p className="text-sm text-muted-foreground">{t("easy.listing.own_phone")}</p>
                {ownPhones.map((p) => (
                  <a
                    key={p}
                    href={telHref(p)}
                    data-tel
                    aria-label={`${t("easy.card.call")}: ${formatPhone(p)}`}
                    className="press -mx-2 flex min-h-12 items-center gap-3 rounded-xl px-2 hover:bg-secondary"
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-success-soft text-success">
                      <Phone className="size-4.5" aria-hidden />
                    </span>
                    <span className="text-lg font-semibold tabular">{formatPhone(p)}</span>
                  </a>
                ))}
              </div>
            ) : null}
            <Link
              // 0086: bir nechta e'lon — asosiysi /post/worker, qolganlari ?listing=<id>
              href={session?.workerId === w.id ? "/post/worker" : `/post/worker?listing=${w.id}`}
              className="press mt-1 flex min-h-12 items-center gap-3 border-t border-border px-4 text-base font-semibold text-primary-ink hover:bg-secondary"
            >
              <Pencil className="size-5 shrink-0" aria-hidden />
              <span className="flex-1">{t("easy.cabinet.edit")}</span>
              <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
            </Link>
          </div>
        ) : null}

        {/* I1: ixcham — surat/kasb belgisi ism yonida (katta bo'sh rasm o'rniga), ma'lumotlar ikki ustunda */}
        <article className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6">
          <p className="text-sm font-bold uppercase tracking-wide text-primary-ink">{t("easy.listing.title")}</p>
          <div className="mt-2 flex items-center gap-3">
            <Photo
              src={w.avatar_url}
              alt={fullName}
              sizes="64px"
              className="size-16 shrink-0 rounded-2xl"
              fallback={<ProfessionImage url={w.profession_node_id ? images[w.profession_node_id] : null} icon={w.category_icon} name={profession} className="size-16 shrink-0" iconClassName="size-8" />}
            />
            <div className="min-w-0">
              <h1 className="break-words text-2xl font-extrabold leading-tight">{fullName}</h1>
              <p className="break-words text-lg font-semibold text-primary-ink">{profession}</p>
            </div>
          </div>
          {/* ega (2026-11-18): "Hozir ish qidirmoqda" — qizil qalin, ko'zga tashlanib tursin (faqat haqiqiy holat) */}
          {statuses.get(w.id) === "active" ? <LiveStatus kind="seeking" className="mt-3 text-base" /> : null}
          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
            <div className="col-span-2">
              <dt className="text-sm text-muted-foreground">{t("easy.listing.location")}</dt>
              <dd className="flex items-start gap-1.5 text-base font-semibold leading-snug">
                <MapPin className="mt-0.5 size-4.5 shrink-0 text-primary-ink" aria-hidden />
                <span>
                  {[region, district ?? t(isCityRegion({ name_uz: w.region_name_uz }) ? "easy.card.city_wide" : "easy.card.region_wide")].filter(Boolean).join(" · ")}
                  {w.remote_ok ? <span className="font-normal text-muted-foreground"> · {t("easy.card.remote")}</span> : null}
                </span>
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-sm text-muted-foreground">{t("easy.listing.experience")}</dt>
              <dd className="text-base font-semibold leading-snug">{exp ? t(`easy.worker.exp.${exp}`) : "—"}</dd>
            </div>
            {w.salary_expected ? (
              <div className="min-w-0">
                <dt className="text-sm text-muted-foreground">{t("easy.listing.salary")}</dt>
                <dd className="text-base font-semibold leading-snug tabular">{formatMoney(w.salary_expected, locale)}</dd>
              </div>
            ) : null}
            {w.schedules?.filter((s) => s !== "negotiable").length ? (
              <div className="col-span-2">
                <dt className="text-sm text-muted-foreground">{t("jobs.detail.schedule")}</dt>
                <dd className="text-base font-semibold leading-snug">{w.schedules.filter((s) => s !== "negotiable").map((s) => tEnum("work_schedule", s)).join(", ")}</dd>
              </div>
            ) : null}
          </dl>
          {w.about ? (
            <section className="mt-4 border-t border-border/70 pt-3">
              <h2 className="text-lg font-bold">{t("easy.listing.about")}</h2>
              <p className="mt-1 whitespace-pre-line text-base">{w.about}</p>
            </section>
          ) : null}
        </article>

        {!w.is_owner ? (
          <section id="contact" className="scroll-mt-24 space-y-3 rounded-2xl border border-success/30 bg-success-soft/40 p-4 text-base sm:p-5">
            <h2 className="text-lg font-bold">{t("easy.listing.contact")}</h2>
            {w.phone ? (
              // raqam ochilgan (yoki admin): qo'ng'iroq, qo'shimcha raqam va — raqamni ochgan bo'lsa — chat
              <>
                <CallBlock phone={w.phone} />
                {/* 0081: qo'shimcha raqam ("+ Yana raqam") */}
                {w.phone2 ? (
                  <a
                    href={telHref(w.phone2)}
                    className="press flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 text-base font-semibold hover:bg-secondary"
                    data-listing-phone2
                  >
                    <Phone className="size-5" aria-hidden /> {t("easy.listing.phone2")}: <span className="tabular">{formatPhone(w.phone2)}</span>
                  </a>
                ) : null}
                {session && "unlocked" in w && w.unlocked ? <ChatButton workerId={w.id} /> : null}
              </>
            ) : (
              // ega (2026-11-22, A varianti): "Raqamni ko'rsatish" (bepul davr) yoki "Raqamni ochish · 5 000 so'm";
              // mehmon pullik rejimda — avval kirish, keyin shu e'longa qaytadi
              <RevealPhone
                kind="worker"
                id={w.id}
                loginHref={session ? null : `/auth?next=${encodeURIComponent(`/listing/${w.id}`)}`}
                price={unlockConfig.paid ? unlockConfig.price : null}
              />
            )}
            {isEmployer ? (
              <Button asChild variant="outline" className="h-12 w-full text-base">
                <Link href={`/workers/${w.id}`}>{t("easy.listing.open_full")}</Link>
              </Button>
            ) : null}
          </section>
        ) : null}
      </div>
    </Shell>
  );
}
