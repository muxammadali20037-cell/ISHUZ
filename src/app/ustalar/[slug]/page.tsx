import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BadgeCheck, Clock, Eye, MapPin, Star } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { getRegions, getDistricts } from "@/lib/reference";
import { formatRelative, initials } from "@/lib/format";
import { getSession } from "@/features/auth/session";
import { vacancyPhotoUrl } from "@/features/post/photo";
import { MastersShell } from "@/features/masters/components/masters-shell";
import { CategoryIcon } from "@/features/masters/components/category-icon";
import {
  MasterCard,
  hm,
  priceText,
} from "@/features/masters/components/master-card";
import {
  PhoneButton,
  RequestForm,
  ReviewForm,
  ViewCounter,
} from "@/features/masters/components/detail-client";
import {
  getMasterBySlug,
  getMasterCategories,
  getMasterReviews,
  searchMasters,
} from "@/features/masters/queries";
import { masterSearchHref } from "@/features/masters/schema";
import { Avatar } from "@/components/ui/avatar";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const [{ t }, { slug }] = await Promise.all([getT(), params]);
  const m = await getMasterBySlug(slug);
  if (!m)
    return { title: t("masters.detail.not_found"), robots: { index: false } };
  return {
    title: `${m.display_name} — ${m.title} · ${t("masters.name")}`,
    description: m.description.slice(0, 160),
    robots: m.is_demo ? { index: false } : undefined,
  };
}

/**
 * /ustalar/[slug] — usta e'loni: rasmlar, ism, kategoriya, reyting (faqat haqiqiy sharhlar), tajriba, xizmatlar, hudud, ish vaqti,
 * narx; bog'lanish — telefon (egasi rozilik bergan bo'lsa, bosilganda hisoblanadi) yoki so'rov formasi; sharhlar.
 * Demo e'lon: "Demo" belgisi, bog'lanish va sharh yo'q.
 */
export default async function MasterDetailPage({ params }: { params: Params }) {
  const { slug } = await params;
  const m = await getMasterBySlug(slug);
  if (!m) notFound();
  const [
    { t, name, locale },
    session,
    categories,
    regions,
    districts,
    reviews,
  ] = await Promise.all([
    getT(),
    getSession(),
    getMasterCategories(),
    getRegions(),
    getDistricts(),
    getMasterReviews(m.id),
  ]);
  const category = categories.find((c) => c.id === m.category_id) ?? null;
  const region = m.region_id
    ? (regions.find((r) => r.id === m.region_id) ?? null)
    : null;
  const district = m.district_id
    ? (districts.find((d) => d.id === m.district_id) ?? null)
    : null;
  const own = !!session && session.userId === m.owner_profile_id;
  const others = category
    ? await searchMasters({ category: category.slug, limit: 5 })
    : null;
  const related = (others?.items ?? [])
    .filter((x) => x.id !== m.id)
    .slice(0, 4);
  const photos = m.photos
    .map((p) => vacancyPhotoUrl(p))
    .filter((u): u is string => !!u);
  const hasRating = m.rating_count > 0 && m.rating_avg !== null;

  return (
    <MastersShell>
      {!m.is_demo ? <ViewCounter id={m.id} /> : null}
      <article
        className="container-app grid gap-6 py-4 sm:py-6 lg:grid-cols-[minmax(0,1fr)_360px]"
        data-masters-detail
        data-demo={m.is_demo || undefined}
      >
        <div className="min-w-0 space-y-5">
          {photos.length ? (
            <ul
              className="grid grid-cols-2 gap-2 sm:grid-cols-4"
              data-masters-photos
            >
              {photos.map((u, i) => (
                <li key={u} className={i === 0 ? "col-span-2 row-span-2" : ""}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- Supabase storage */}
                  <img
                    src={u}
                    alt=""
                    className="aspect-[4/3] size-full rounded-2xl object-cover"
                    loading={i === 0 ? "eager" : "lazy"}
                  />
                </li>
              ))}
            </ul>
          ) : null}

          <header className="flex items-start gap-4">
            <Avatar
              src={m.avatar_url}
              fallback={
                initials(
                  m.display_name.split(" ")[0],
                  m.display_name.split(" ")[1],
                ) || "?"
              }
              size="lg"
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-extrabold tracking-tight">
                  {m.display_name}
                </h1>
                {m.is_demo ? (
                  <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-bold text-muted-foreground">
                    {t("masters.demo_badge")}
                  </span>
                ) : null}
              </div>
              <p className="mt-0.5 text-lg">{m.title}</p>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                {category ? (
                  <Link
                    href={masterSearchHref({ category: category.slug })}
                    className="-my-2 inline-flex min-h-11 items-center gap-1 font-semibold text-primary-ink hover:underline"
                  >
                    <CategoryIcon icon={category.icon} className="size-4" />{" "}
                    {name(category)}
                  </Link>
                ) : null}
                {hasRating ? (
                  <span className="inline-flex items-center gap-1 font-semibold text-foreground">
                    <Star
                      className="size-4 text-warning"
                      fill="currentColor"
                      aria-hidden
                    />{" "}
                    {t("masters.card.rating", {
                      rating: Number(m.rating_avg).toFixed(1),
                      count: m.rating_count,
                    })}
                  </span>
                ) : (
                  <span>{t("masters.card.no_rating")}</span>
                )}
                {!m.is_demo ? (
                  <span className="inline-flex items-center gap-1">
                    <Eye className="size-4" aria-hidden />{" "}
                    {t("masters.detail.views", { count: m.views_count })}
                  </span>
                ) : null}
              </p>
            </div>
          </header>

          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              [
                t("masters.detail.experience"),
                m.experience_years > 0
                  ? t("masters.card.experience", { years: m.experience_years })
                  : t("masters.card.experience_none"),
              ],
              [
                t("masters.detail.area"),
                `${region ? name(region) : t("masters.detail.whole_country")}${district ? ` · ${name(district)}` : ""}${m.service_area ? ` · ${m.service_area}` : ""}`,
              ],
              [
                t("masters.detail.hours"),
                m.work_from && m.work_to
                  ? t("masters.card.hours", {
                      from: hm(m.work_from),
                      to: hm(m.work_to),
                    })
                  : "—",
              ],
              [t("masters.detail.price"), priceText(t, locale, m)],
            ].map(([k, v]) => (
              <div
                key={k}
                className="rounded-2xl border border-border bg-card p-3"
              >
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {k}
                </dt>
                <dd className="mt-1 text-base font-bold leading-snug">{v}</dd>
              </div>
            ))}
          </dl>

          {m.services.length ? (
            <section aria-labelledby="m-services">
              <h2 id="m-services" className="text-lg font-bold">
                {t("masters.detail.services")}
              </h2>
              <ul className="mt-2 flex flex-wrap gap-2">
                {m.services.map((s) => (
                  <li
                    key={s}
                    className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-3 py-1.5 text-sm font-semibold text-primary-ink"
                  >
                    <BadgeCheck className="size-4" aria-hidden /> {s}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section aria-labelledby="m-about">
            <h2 id="m-about" className="text-lg font-bold">
              {t("masters.detail.about")}
            </h2>
            <p className="mt-2 whitespace-pre-wrap text-base leading-relaxed">
              {m.description}
            </p>
            {m.is_demo ? (
              <p className="mt-3 rounded-xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
                {t("masters.demo_note")}
              </p>
            ) : null}
          </section>

          <section aria-labelledby="m-reviews" data-masters-reviews>
            <h2 id="m-reviews" className="text-lg font-bold">
              {t("masters.detail.reviews")}{" "}
              {hasRating ? (
                <span className="text-muted-foreground">
                  ({m.rating_count})
                </span>
              ) : null}
            </h2>
            {reviews.length ? (
              <ul className="mt-3 space-y-3">
                {reviews.map((r) => (
                  <li
                    key={r.id}
                    className="rounded-2xl border border-border bg-card p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-bold">
                        {[
                          r.author?.first_name,
                          r.author?.last_name?.slice(0, 1),
                        ]
                          .filter(Boolean)
                          .join(" ") || "—"}
                      </span>
                      <span
                        className="inline-flex items-center gap-0.5 text-warning"
                        aria-label={`${r.rating}/5`}
                      >
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            className="size-4"
                            fill={i < r.rating ? "currentColor" : "none"}
                            strokeWidth={i < r.rating ? 0 : 1.5}
                            aria-hidden
                          />
                        ))}
                      </span>
                    </div>
                    {r.text ? (
                      <p className="mt-1.5 text-base">{r.text}</p>
                    ) : null}
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatRelative(r.created_at, locale)}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-muted-foreground">
                {t("masters.detail.no_reviews")}
              </p>
            )}
            {m.is_demo || own ? null : session ? (
              <div className="mt-4">
                <ReviewForm listingId={m.id} />
              </div>
            ) : (
              <Link
                href={`/auth?next=${encodeURIComponent(`/ustalar/${m.slug}`)}`}
                className="mt-3 inline-flex min-h-11 items-center font-semibold text-primary-ink hover:underline"
              >
                {t("masters.detail.login_review")}
              </Link>
            )}
          </section>
        </div>

        <aside
          className="space-y-4 lg:sticky lg:top-20 lg:self-start"
          data-masters-contact
        >
          <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
            <h2 className="text-lg font-bold">{t("masters.detail.contact")}</h2>
            {m.is_demo ? (
              <p className="mt-2 text-muted-foreground">
                {t("masters.detail.demo_contact")}
              </p>
            ) : own ? (
              <p className="mt-2 text-muted-foreground">
                {t("masters.request.own")}
              </p>
            ) : (
              <>
                {m.phone ? (
                  <div className="mt-3 grid gap-2">
                    <PhoneButton id={m.id} phone={m.phone} />
                    <p className="text-xs text-muted-foreground">
                      {t("masters.detail.phone_note")}
                    </p>
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground">
                    {t("masters.detail.phone_hidden")}
                  </p>
                )}
                <h3 className="mt-5 text-base font-bold">
                  {t("masters.detail.request_title")}
                </h3>
                <p className="mb-3 mt-1 text-sm text-muted-foreground">
                  {t("masters.detail.request_desc")}
                </p>
                <RequestForm
                  listingId={m.id}
                  defaultName={session?.profile.first_name ?? undefined}
                />
              </>
            )}
          </div>
          <ul className="space-y-1 text-sm text-muted-foreground">
            <li className="flex items-center gap-1.5">
              <MapPin className="size-4" aria-hidden />{" "}
              {region ? name(region) : t("masters.detail.whole_country")}
            </li>
            {m.work_from && m.work_to ? (
              <li className="flex items-center gap-1.5">
                <Clock className="size-4" aria-hidden />{" "}
                {t("masters.card.hours", {
                  from: hm(m.work_from),
                  to: hm(m.work_to),
                })}
              </li>
            ) : null}
          </ul>
        </aside>
      </article>

      {related.length ? (
        <section className="container-app pb-8" aria-labelledby="m-related">
          <h2 id="m-related" className="text-xl font-bold">
            {t("masters.detail.other_in_category")}
          </h2>
          <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {related.map((x) => (
              <li key={x.id} className="flex">
                <MasterCard m={x} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </MastersShell>
  );
}
