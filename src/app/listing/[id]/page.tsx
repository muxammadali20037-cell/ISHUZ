import { VacancyDescription } from "@/features/jobs/components/vacancy-description";
import { ListingPhoto } from "@/features/listing-image/components/listing-photo";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { BriefcaseBusiness, ChevronLeft, ChevronRight, Clock, MapPin, Pencil, Phone, Wifi } from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getCategories } from "@/lib/reference";

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
  const [images, statuses, categories] = await Promise.all([getProfessionImages([w.profession_node_id]), workerStatuses([w.id]), getCategories()]);
  const category = categories.find((c) => c.slug === w.category_slug) ?? null;
  const profession = w.profession_name_uz ? name({ name_uz: w.profession_name_uz, name_ru: w.profession_name_ru ?? w.profession_name_uz, name_en: w.profession_name_en }) : (w.headline ?? "");
  const region = w.region_name_uz ? name({ name_uz: w.region_name_uz, name_ru: w.region_name_ru ?? w.region_name_uz, name_en: w.region_name_en, name_oz: w.region_name_oz }) : null;
  const district = w.district_name_uz ? name({ name_uz: w.district_name_uz, name_ru: w.district_name_ru ?? w.district_name_uz, name_en: w.district_name_en, name_oz: w.district_name_oz }) : null;
  const exp = levelToExperience(w.experience_level);
  const fullName = `${w.first_name}${w.last_initial ? ` ${w.last_initial}.` : ""}`;
  const isEmployer = !!session?.employerId;
  const ownPhones = w.is_owner ? [w.phone, w.phone2].filter((p): p is string => !!p) : [];
  const schedules = (w.schedules ?? []).filter((x) => x !== "negotiable");
  const fact = (label: string, value: ReactNode, icon?: ReactNode, wide = false) => (
    <div className={wide ? "col-span-2 min-w-0" : "min-w-0"}>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 flex items-start gap-1.5 text-base font-semibold leading-snug">
        {icon}
        <span className="min-w-0">{value}</span>
      </dd>
    </div>
  );
  const facts = (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-4" data-listing-facts>
      {fact(
        t("easy.listing.location"),
        <>
          {[region, district ?? t(isCityRegion({ name_uz: w.region_name_uz }) ? "easy.card.city_wide" : "easy.card.region_wide")].filter(Boolean).join(" · ")}
        </>,
        <MapPin className="mt-0.5 size-4.5 shrink-0 text-primary-ink" aria-hidden />,
        true,
      )}
      {fact(t("easy.listing.experience"), exp ? t(`easy.worker.exp.${exp}`) : "—", <BriefcaseBusiness className="mt-0.5 size-4.5 shrink-0 text-primary-ink" aria-hidden />)}
      {category ? fact(t("easy.listing.field"), name(category)) : null}
      {schedules.length ? fact(t("jobs.detail.schedule"), schedules.map((x) => tEnum("work_schedule", x)).join(", "), <Clock className="mt-0.5 size-4.5 shrink-0 text-primary-ink" aria-hidden />) : null}
      {w.remote_ok ? fact(t("easy.listing.format"), t("easy.card.remote"), <Wifi className="mt-0.5 size-4.5 shrink-0 text-primary-ink" aria-hidden />) : null}
    </dl>
  );

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

        {/*
          Professional ko'rinish (ega, 2026-11-22: "ishchi bo'lsam ham e'lonim professional ko'rinsin" — vakansiya sahifasidek):
          sarlavha (kasb), kutilayotgan maosh, odam qatori; ostida "Ma'lumot" / "O'zi haqida" bo'limlari. Faqat bor ma'lumot.
        */}
        <article className="overflow-hidden rounded-xl border border-border bg-card shadow-sm" data-listing-card>
          <div className="p-4 sm:p-6">
            <p className="text-xs font-extrabold uppercase tracking-wider text-primary-ink">{t("easy.listing.title")}</p>
            <h1 className="mt-1 break-words text-2xl font-extrabold leading-tight sm:text-3xl">{profession}</h1>
            {w.salary_expected ? (
              <p className="mt-1.5 text-xl font-extrabold text-primary-ink tabular" data-listing-salary>
                {formatMoney(w.salary_expected, locale)} <span className="text-sm font-semibold text-muted-foreground">· {t("easy.listing.salary")}</span>
              </p>
            ) : null}
            {/* ega (2026-11-18): "Hozir ish qidirmoqda" — faqat haqiqiy holat */}
            {statuses.get(w.id) === "active" ? <LiveStatus kind="seeking" className="mt-2 text-base" /> : null}
            <div className="mt-4 flex items-center gap-3 border-t border-border pt-4" data-listing-person>
              <Photo
                src={w.avatar_url}
                alt={fullName}
                sizes="48px"
                className="size-12 shrink-0 rounded-lg"
                fallback={<ProfessionImage url={w.profession_node_id ? images[w.profession_node_id] : null} icon={w.category_icon} name={profession} className="size-12 shrink-0" iconClassName="size-6" />}
              />
              <div className="min-w-0">
                <p className="break-words text-lg font-bold leading-tight">{fullName}</p>
                <p className="mt-0.5 flex items-center gap-1 text-sm text-muted-foreground">
                  <MapPin className="size-3.5 shrink-0" aria-hidden />
                  <span className="truncate">{region ?? t("easy.location.whole_country")}</span>
                </p>
              </div>
            </div>
          </div>

          {w.about ? (
            <Tabs defaultValue="info">
              <TabsList variant="underline" className="px-4 sm:px-6">
                <TabsTrigger value="info" className="min-h-11 flex-none px-1 text-base font-bold sm:px-2">
                  {t("easy.listing.details")}
                </TabsTrigger>
                <TabsTrigger value="about" className="ml-4 min-h-11 flex-none px-1 text-base font-bold sm:px-2">
                  {t("easy.listing.about")}
                </TabsTrigger>
              </TabsList>
              <TabsContent value="info" className="p-4 sm:p-6">
                {facts}
              </TabsContent>
              <TabsContent value="about" className="p-4 sm:p-6">
                {/* izoh bandlari (✅) — yashil belgili ro'yxat bo'lib */}
                <div data-listing-about>
                  <VacancyDescription text={w.about} className="text-base" />
                </div>
              </TabsContent>
            </Tabs>
          ) : (
            <div className="border-t border-border p-4 sm:p-6">{facts}</div>
          )}
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
