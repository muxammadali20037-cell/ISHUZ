import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ArrowLeft, BriefcaseBusiness, Clock, MapPin, Pencil, Wallet } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/format";
import { getSession } from "@/features/auth/session";
import { Shell } from "@/components/shared/shell";
import { Button } from "@/components/ui/button";
import { ProfessionImage } from "@/components/shared/profession-image";
import { CallBlock } from "@/features/find/components/result-cards";
import { levelToExperience } from "@/features/post/types";
import { getProfessionImages } from "@/lib/profession-images/server";

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

  return (
    <Shell>
      <div className="container-narrow space-y-5 py-4 text-lg sm:py-8">
        <Button asChild variant="outline" className="h-12 px-4 text-base">
          <Link href={w.is_owner ? "/cabinet" : "/search"}>
            <ArrowLeft className="size-5" aria-hidden /> {w.is_owner ? t("easy.cabinet.title") : t("easy.listing.back")}
          </Link>
        </Button>

        {w.is_owner ? (
          <div className={w.is_listed ? "rounded-2xl border-2 border-success bg-success-soft p-4" : "rounded-2xl border-2 border-warning bg-warning-soft p-4"}>
            <p className="font-bold">{w.is_listed ? t("easy.cabinet.status.listed") : t("easy.cabinet.status.payment_required")}</p>
            <Button asChild variant="outline" className="mt-3 h-12 bg-card px-4 text-base">
              <Link href="/post/worker">
                <Pencil className="size-5" aria-hidden /> {t("easy.cabinet.edit")}
              </Link>
            </Button>
          </div>
        ) : null}

        <article className="space-y-5 rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-6">
          <p className="text-base font-bold uppercase tracking-wide text-primary">{t("easy.listing.title")}</p>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            {w.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={w.avatar_url} alt={fullName} className="aspect-[4/3] w-full rounded-2xl object-cover sm:w-56" />
            ) : (
              <ProfessionImage url={w.profession_node_id ? images[w.profession_node_id] : null} categorySlug={w.category_slug} icon={w.category_icon} name={profession} label={t("easy.image.label")} className="aspect-[4/3] w-full sm:w-56" />
            )}
            <div className="min-w-0">
              <h1 className="text-3xl font-extrabold leading-tight">{fullName}</h1>
              <p className="mt-1 text-xl font-semibold text-primary">{profession}</p>
            </div>
          </div>
          <ul className="space-y-2">
            <li className="flex items-start gap-2">
              <MapPin className="mt-1 size-5 shrink-0 text-primary" aria-hidden />
              <span>
                {[region, district ?? t("easy.card.region_wide")].filter(Boolean).join(" · ")}
                {w.remote_ok ? <span className="text-muted-foreground"> · {t("easy.card.remote")}</span> : null}
              </span>
            </li>
            <li className="flex items-start gap-2">
              <BriefcaseBusiness className="mt-1 size-5 shrink-0 text-primary" aria-hidden />
              <span>{t("easy.card.experience", { value: exp ? t(`easy.worker.exp.${exp}`) : "—" })}</span>
            </li>
            {w.salary_expected ? (
              <li className="flex items-start gap-2">
                <Wallet className="mt-1 size-5 shrink-0 text-primary" aria-hidden />
                <span>{t("easy.card.salary_expected", { amount: formatMoney(w.salary_expected, locale) })}</span>
              </li>
            ) : null}
            {w.schedules?.filter((s) => s !== "negotiable").length ? (
              <li className="flex items-start gap-2">
                <Clock className="mt-1 size-5 shrink-0 text-primary" aria-hidden />
                <span>{w.schedules.filter((s) => s !== "negotiable").map((s) => tEnum("work_schedule", s)).join(", ")}</span>
              </li>
            ) : null}
          </ul>
          {w.about ? (
            <section>
              <h2 className="text-xl font-bold">{t("easy.listing.about")}</h2>
              <p className="mt-2 whitespace-pre-line">{w.about}</p>
            </section>
          ) : null}
        </article>

        {!w.is_owner ? (
          <section className="space-y-3 rounded-3xl border border-success/30 bg-success-soft/40 p-5">
            <h2 className="text-xl font-bold">{t("easy.listing.contact")}</h2>
            {w.phone ? (
              <>
                <CallBlock phone={w.phone} />
                {isEmployer ? (
                  <Button asChild variant="outline" className="h-12 w-full text-base">
                    <Link href={`/workers/${w.id}`}>{t("easy.listing.open_full")}</Link>
                  </Button>
                ) : null}
              </>
            ) : (
              <>
                <p>{session ? t("easy.listing.contact_hidden_logged") : t("easy.listing.contact_hidden")}</p>
                <Button asChild size="xl" className="h-14 w-full text-lg">
                  <Link href={session ? `/workers/${w.id}` : `/auth?next=${encodeURIComponent(`/workers/${w.id}`)}`}>{session ? t("easy.listing.open_full") : t("easy.cabinet.login")}</Link>
                </Button>
              </>
            )}
          </section>
        ) : null}
      </div>
    </Shell>
  );
}
