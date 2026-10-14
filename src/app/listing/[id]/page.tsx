import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ChevronLeft, MapPin, Pencil } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/format";
import { getSession } from "@/features/auth/session";
import { Shell } from "@/components/shared/shell";
import { Button } from "@/components/ui/button";
import { ProfessionImage } from "@/components/shared/profession-image";
import { Photo } from "@/components/shared/photo";
import { CallBlock } from "@/features/find/components/result-cards";
import { StatusPill } from "@/features/cabinet/components/status-pill";
import { levelToExperience } from "@/features/post/types";
import { getProfessionImages } from "@/lib/profession-images/server";
import { RequestContactButton } from "@/features/contacts/request-contact-button";
import { isCityRegion } from "@/lib/geo/city";
import { BackLink } from "@/components/shared/back-link";

type Params = { params: Promise<{ id: string }> };

async function load(id: string) {
  if (!z.uuid().safeParse(id).success) return null;
  const supabase = await createClient();
  const { data } = await supabase.rpc("simple_worker_listing", { p_id: id });
  return data?.[0] ?? null;
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
  const [{ t, tEnum, name, locale }, w, session] = await Promise.all([getT(), load(id), getSession()]);
  if (!w) notFound();
  const images = await getProfessionImages([w.profession_node_id]);
  const profession = w.profession_name_uz ? name({ name_uz: w.profession_name_uz, name_ru: w.profession_name_ru ?? w.profession_name_uz, name_en: w.profession_name_en }) : (w.headline ?? "");
  const region = w.region_name_uz ? name({ name_uz: w.region_name_uz, name_ru: w.region_name_ru ?? w.region_name_uz, name_en: w.region_name_en, name_oz: w.region_name_oz }) : null;
  const district = w.district_name_uz ? name({ name_uz: w.district_name_uz, name_ru: w.district_name_ru ?? w.district_name_uz, name_en: w.district_name_en, name_oz: w.district_name_oz }) : null;
  const exp = levelToExperience(w.experience_level);
  const fullName = `${w.first_name}${w.last_initial ? ` ${w.last_initial}.` : ""}`;
  const isEmployer = !!session?.employerId;
  // G4: raqam yashirin — kirgan foydalanuvchi shu yerning o'zida so'rov yuboradi (to'liq profilga o'tish shart emas)
  const contact = session && !w.phone && !w.is_owner ? await contactRequestState(w.id) : null;

  return (
    <Shell>
      <div className="container-narrow space-y-3 py-3 text-lg sm:py-8">
        {/* qidiruvdan kelgan bo'lsa — o'sha natijalarga (o'sha joyiga) qaytadi */}
        <BackLink
          fallback={w.is_owner ? "/cabinet" : "/search?mode=workers"}
          className="-ml-1 inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-base font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <ChevronLeft className="size-5" aria-hidden /> {w.is_owner ? t("easy.cabinet.title") : t("easy.wizard.back")}
        </BackLink>

        {w.is_owner ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4">
            <StatusPill tone={w.is_listed ? "ok" : "wait"}>{w.is_listed ? t("easy.cabinet.status.listed") : t("easy.cabinet.status.payment_required")}</StatusPill>
            <Button asChild variant="outline" className="h-12 px-4 text-base">
              <Link href="/post/worker">
                <Pencil className="size-5" aria-hidden /> {t("easy.cabinet.edit")}
              </Link>
            </Button>
          </div>
        ) : null}

        {/* I1: ixcham — surat/kasb belgisi ism yonida (katta bo'sh rasm o'rniga), ma'lumotlar ikki ustunda */}
        <article className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6">
          <p className="text-sm font-bold uppercase tracking-wide text-primary">{t("easy.listing.title")}</p>
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
              <p className="break-words text-lg font-semibold text-primary">{profession}</p>
            </div>
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
            <div className="col-span-2">
              <dt className="text-sm text-muted-foreground">{t("easy.listing.location")}</dt>
              <dd className="flex items-start gap-1.5 text-base font-semibold leading-snug">
                <MapPin className="mt-0.5 size-4.5 shrink-0 text-primary" aria-hidden />
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
              <>
                <CallBlock phone={w.phone} />
                {isEmployer ? (
                  <Button asChild variant="outline" className="h-12 w-full text-base">
                    <Link href={`/workers/${w.id}`}>{t("easy.listing.open_full")}</Link>
                  </Button>
                ) : null}
              </>
            ) : session ? (
              <>
                <p>{contact?.canRequest ? t("contacts.request.hint") : t("common.contact_locked")}</p>
                {contact?.canRequest ? <RequestContactButton profileId={contact.ownerId} initial={contact.status} size="xl" /> : null}
                {isEmployer ? (
                  <Button asChild variant="outline" className="h-12 w-full text-base">
                    <Link href={`/workers/${w.id}`}>{t("easy.listing.open_full")}</Link>
                  </Button>
                ) : null}
              </>
            ) : (
              <>
                <p>{t("easy.listing.contact_hidden")}</p>
                <Button asChild size="xl" className="h-14 w-full text-lg">
                  <Link href={`/auth?next=${encodeURIComponent(`/listing/${w.id}`)}`}>{t("easy.cabinet.login")}</Link>
                </Button>
              </>
            )}
          </section>
        ) : null}
      </div>
    </Shell>
  );
}

/**
 * E'lon egasi (profil) va raqam so'rovi holati — kontakt kartasidagi qoida bilan bir xil (`contact_status_for`):
 * egasi raqamni umuman yashirgan bo'lsa ("nobody") so'rash tugmasi ko'rsatilmaydi.
 */
async function contactRequestState(workerId: string): Promise<{ ownerId: string; status: "none" | "pending" | "declined"; canRequest: boolean } | null> {
  const supabase = await createClient();
  const { data: wp } = await supabase.from("worker_profiles").select("profile_id").eq("id", workerId).maybeSingle();
  if (!wp?.profile_id) return null;
  const { data: status } = await supabase.rpc("contact_status_for", { p_owner: wp.profile_id });
  const canRequest = status === "none" || status === "pending" || status === "declined";
  return { ownerId: wp.profile_id, status: canRequest ? status : "none", canRequest };
}
