import type { Metadata } from "next";
import Link from "next/link";
import { BellRing, ChevronRight, ExternalLink, MapPin } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { localeAlternates } from "@/lib/seo";
import { getDistricts, getRegions } from "@/lib/reference";
import { Shell } from "@/components/shared/shell";
import { Button } from "@/components/ui/button";
import { getHomePlace } from "@/features/landing/home-queries";
import { JobResultCard } from "@/features/find/components/result-cards";
import { RetryButton } from "@/features/find/components/find-client";
import { DemoJobCard } from "@/features/demo-vacancies/components/demo-job-card";
import { getMapJobs } from "@/features/jobs-map/queries";
import { MAX_PINS, roundKm, spread, yandexMapsUrl, yandexWidgetUrl, zoomFor, type MapPin as Pin } from "@/features/jobs-map/geo";
import { MapLocate } from "@/features/jobs-map/components/map-locate";
import { cn } from "@/lib/utils";

type Search = Promise<{ region?: string | string[]; district?: string | string[] }>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export async function generateMetadata(): Promise<Metadata> {
  const { t, locale } = await getT();
  return { title: t("map.title"), description: t("map.meta_description"), alternates: localeAlternates("/jobs/xarita", locale) };
}

/**
 * /jobs/xarita — yaqin atrofdagi ishlar Yandex xaritasida (2026-11-12, ega: "real karta qo'shish kerak yaqin atrofdagi ishlarni
 * ko'rish uchun — Yandex kartani"). Joy: URL (region, district) → eslab qolingan hudud → Toshkent shahri. "Joylashuvim bo'yicha" —
 * brauzer eng yaqin tumanni o'zi topadi (koordinata serverga bormaydi). Xarita — API kalitsiz Yandex vidjeti (iframe), raqamli
 * belgilar ro'yxat bilan mos; JS'siz ham ishlaydi (forma GET). Haqiqiy e'lon bo'lmasa — kulrang namuna belgilari, ochiq yozilgan.
 */
export default async function JobsMapPage({ searchParams }: { searchParams: Search }) {
  const sp = await searchParams;
  const [{ t, name, locale }, regions, districts, home] = await Promise.all([getT(), getRegions(), getDistricts(), getHomePlace()]);
  const asked = regions.find((r) => r.slug === one(sp.region)) ?? null;
  const region = asked ?? home.region ?? regions.find((r) => r.slug === "tashkent_city") ?? regions[0]!;
  const district =
    districts.find((d) => d.id === one(sp.district) && d.region_id === region.id) ??
    (!asked && home.district && home.district.region_id === region.id ? home.district : null);
  const placeName = district ? `${name(region)} · ${name(district)}` : name(region);
  const res = await getMapJobs(region, district, districts);
  const regionDistricts = districts.filter((d) => d.region_id === region.id);

  const real = res.ok ? res.jobs : [];
  const pinned = real.filter((j) => j.point).slice(0, MAX_PINS);
  const unpinned = real.filter((j) => !j.point);
  const demo = res.ok ? res.demo : [];
  const rawPins: Pin[] = pinned.length
    ? pinned.map((j, i) => ({ ...j.point!, n: i + 1, kind: "real" as const }))
    : demo.map((d, i) => ({ ...d.point, n: i + 1, kind: "demo" as const }));
  const pins = spread(rawPins);
  const center = res.ok ? res.center : null;
  const mapCenter = center ?? (pins[0] ? { lat: pins[0].lat, lng: pins[0].lng } : null);
  const zoom = mapCenter ? zoomFor(pins.length ? [...pins, mapCenter] : [mapCenter], mapCenter) : 12;
  const widget = mapCenter ? yandexWidgetUrl({ pins, center: mapCenter, zoom: pins.length ? zoom : district ? 13 : 10, locale }) : null;
  const external = mapCenter ? yandexMapsUrl({ pins, center: mapCenter, zoom: pins.length ? zoom : 12 }) : null;
  const dist = (km: number | null) => {
    if (km == null) return null;
    const r = roundKm(km);
    return r.unit === "m" ? t("map.distance_m", { value: r.value }) : t("map.distance_km", { value: new Intl.NumberFormat(locale === "en" ? "en-US" : "ru-RU").format(r.value) });
  };

  return (
    <Shell>
      <div className="container-app space-y-5 py-5 sm:py-8" data-jobs-map>
        <header className="max-w-3xl">
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{t("map.title")}</h1>
          <p className="mt-1 text-base text-muted-foreground">{t("map.subtitle")}</p>
        </header>

        <section className="grid gap-4 rounded-2xl border border-border bg-card p-4 lg:grid-cols-[auto_minmax(0,1fr)] lg:items-start" aria-label={t("map.region")}>
          <MapLocate districts={districts.map((d) => ({ id: d.id, region_id: d.region_id, lat: d.lat, lng: d.lng }))} regions={regions.map((r) => ({ id: r.id, slug: r.slug }))} />
          <form action="/jobs/xarita" method="get" className="flex flex-wrap items-end gap-2" data-map-place>
            <label className="min-w-0 flex-1 basis-48">
              <span className="mb-1 block text-sm font-semibold">{t("map.region")}</span>
              <select name="region" defaultValue={region.slug} className="h-12 w-full rounded-xl border border-input bg-card px-3 text-base">
                {regions.map((r) => (
                  <option key={r.id} value={r.slug}>
                    {name(r)}
                  </option>
                ))}
              </select>
            </label>
            <label className="min-w-0 flex-1 basis-48">
              <span className="mb-1 block text-sm font-semibold">{t("map.district")}</span>
              {/* viloyat almashtirilsa — tuman tanlovi shu viloyatniki emas: server uni e'tiborsiz qoldiradi (butun viloyat) */}
              <select name="district" defaultValue={district?.id ?? ""} className="h-12 w-full rounded-xl border border-input bg-card px-3 text-base">
                <option value="">{t("map.all_districts")}</option>
                {regionDistricts.map((d) => (
                  <option key={d.id} value={d.id}>
                    {name(d)}
                  </option>
                ))}
              </select>
            </label>
            <Button type="submit" variant="outline" className="h-12 px-5 text-base">
              {t("map.show")}
            </Button>
          </form>
        </section>

        {!res.ok ? (
          <section role="alert" className="space-y-3 rounded-xl border border-warning/40 bg-warning-soft p-5 text-center">
            <h2 className="text-lg font-bold">{t("map.error_title")}</h2>
            <p className="text-muted-foreground">{t("map.error_desc")}</p>
            <div className="mx-auto grid max-w-sm">
              <RetryButton label={t("easy.search.retry")} />
            </div>
          </section>
        ) : (
          <>
            <section aria-labelledby="map-summary" className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 id="map-summary" className="text-lg font-bold" data-map-summary>
                  {real.length ? t("map.count", { place: placeName, count: res.total }) : t("map.empty_title", { place: placeName })}
                </h2>
                {external ? (
                  <a href={external} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-primary-ink hover:underline" data-map-external>
                    {t("map.open_yandex")} <ExternalLink className="size-4" aria-hidden />
                  </a>
                ) : null}
              </div>
              {widget ? (
                <div className="overflow-hidden rounded-2xl border border-border bg-secondary">
                  <iframe
                    src={widget}
                    title={t("map.map_title", { place: placeName })}
                    className="block aspect-[4/3] w-full sm:aspect-[16/9] lg:aspect-[21/9]"
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    data-map-widget
                  />
                </div>
              ) : (
                <p className="rounded-xl bg-secondary p-3 text-sm">{t("map.no_center")}</p>
              )}
              <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground" aria-label={t("map.list_title")}>
                {pinned.length ? (
                  <li className="flex items-center gap-1.5">
                    <span className="size-3 rounded-full bg-primary" aria-hidden /> {t("map.legend_real")}
                  </li>
                ) : null}
                {demo.length ? (
                  <li className="flex items-center gap-1.5">
                    <span className="size-3 rounded-full bg-muted-foreground" aria-hidden /> {t("map.legend_demo")}
                  </li>
                ) : null}
                {pinned.length && real.length > pinned.length ? <li>{t("map.shown", { shown: pinned.length })}</li> : null}
              </ul>
            </section>

            {pinned.length ? (
              <section aria-label={t("map.list_title")}>
                <ol className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3" data-map-list>
                  {pinned.map((j, i) => (
                    <li key={j.job.id} className="flex flex-col gap-1" data-map-item={i + 1}>
                      <MapLabel n={i + 1} tone="real" distance={dist(j.km)} note={j.exact ? t("map.exact") : t("map.approx")} />
                      <div className="flex flex-1 [&>article]:w-full">
                        <JobResultCard job={j.job} />
                      </div>
                    </li>
                  ))}
                </ol>
              </section>
            ) : null}

            {unpinned.length ? (
              <section aria-labelledby="map-unpinned" className="space-y-3">
                <h2 id="map-unpinned" className="text-base font-bold">
                  {t("map.no_point_title")}
                </h2>
                <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {unpinned.slice(0, 12).map((j) => (
                    <li key={j.job.id} className="flex [&>article]:w-full">
                      <JobResultCard job={j.job} />
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {!real.length ? (
              <section className="space-y-3" aria-label={t("map.list_title")}>
                <p className="text-base text-muted-foreground" data-map-empty>
                  {demo.length ? t("map.empty_desc") : t("map.empty_desc_none")}
                </p>
                {demo.length ? (
                  <ol className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3" data-map-demo-list>
                    {demo.map((d, i) => (
                      <li key={d.job.id} className="flex flex-col gap-1" data-map-item={i + 1}>
                        <MapLabel n={i + 1} tone="demo" distance={dist(d.km)} note={t("map.approx")} />
                        <div className="flex flex-1 [&>article]:w-full">
                          <DemoJobCard job={d.job} />
                        </div>
                      </li>
                    ))}
                  </ol>
                ) : null}
              </section>
            ) : null}

            <nav className="flex flex-wrap gap-2" aria-label={t("map.title")}>
              <Button asChild variant="outline" className="h-12 text-base">
                <Link href="/ai-alerts?role=worker">
                  <BellRing className="size-5" aria-hidden /> {t("map.alert")}
                </Link>
              </Button>
              <Button asChild variant="outline" className="h-12 text-base">
                <Link href={`/jobs?region=${encodeURIComponent(region.slug)}`}>
                  {t("map.all_jobs")} <ChevronRight className="size-5" aria-hidden />
                </Link>
              </Button>
            </nav>
          </>
        )}
      </div>
    </Shell>
  );
}

function MapLabel({ n, tone, distance, note }: { n: number; tone: "real" | "demo"; distance: string | null; note: string }) {
  return (
    <p className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
      <span
        className={cn("flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-bold", tone === "real" ? "bg-primary text-primary-foreground" : "bg-muted-foreground text-background")}
        aria-hidden
      >
        {n}
      </span>
      <MapPin className="size-4 shrink-0" aria-hidden />
      <span className="min-w-0 truncate">{[distance, note].filter(Boolean).join(" · ")}</span>
    </p>
  );
}
