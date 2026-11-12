import Link from "next/link";
import { BadgeCheck, Clock, MapPin, Star } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { formatMoneyShort } from "@/lib/format";
import { getRegions } from "@/lib/reference";
import { vacancyPhotoUrl } from "@/features/post/photo";
import { cn } from "@/lib/utils";
import { CategoryIcon } from "./category-icon";
import { getMasterCategories } from "../queries";
import type { MasterPublic } from "../types";

/** "HH:MM:SS" → "HH:MM" */
export function hm(t: string | null | undefined): string {
  return t ? t.slice(0, 5) : "";
}

export function priceText(
  t: (k: string, p?: Record<string, string | number>) => string,
  locale: string,
  p: {
    price_negotiable: boolean;
    price_from: number | null;
    price_to: number | null;
  },
): string {
  if (p.price_negotiable) return t("masters.card.price_negotiable");
  const loc = locale as "uz" | "ru" | "en" | "oz";
  if (p.price_from !== null && p.price_to !== null)
    return t("masters.card.price_range", {
      from: formatMoneyShort(p.price_from, loc),
      to: formatMoneyShort(p.price_to, loc),
    });
  if (p.price_from !== null)
    return t("masters.card.price_from", {
      amount: formatMoneyShort(p.price_from, loc),
    });
  return t("masters.card.price_to", {
    amount: formatMoneyShort(p.price_to, loc),
  });
}

/**
 * Usta kartasi: rasm (ish namunasi yoki egasining tasdiqlangan surati), ism, sarlavha, kategoriya, tajriba, hudud, ish vaqti,
 * narx, reyting (faqat haqiqiy sharh bo'lsa), demo belgisi. Telefon kartada yo'q — faqat e'lon sahifasida (rozilik bilan).
 */
export async function MasterCard({
  m,
  priority = false,
}: {
  m: MasterPublic;
  priority?: boolean;
}) {
  const [{ t, name, locale }, categories, regions] = await Promise.all([
    getT(),
    getMasterCategories(),
    getRegions(),
  ]);
  const category = categories.find((c) => c.id === m.category_id) ?? null;
  const region = m.region_id
    ? (regions.find((r) => r.id === m.region_id) ?? null)
    : null;
  const photo = m.photos[0] ? vacancyPhotoUrl(m.photos[0]) : m.avatar_url;
  const href = `/ustalar/${m.slug}`;
  const rating = m.rating_count > 0 && m.rating_avg !== null;
  return (
    <article
      className={cn(
        "group relative flex h-full w-full flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-colors hover:border-primary/50",
        m.is_demo && "border-dashed",
      )}
      data-master-card
      data-demo={m.is_demo || undefined}
    >
      <Link
        href={href}
        className="relative block aspect-[4/3] bg-primary-soft"
        aria-label={t("masters.card.open")}
      >
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element -- Supabase storage / tashqi manzil, o'lchami oldindan noma'lum
          <img
            src={photo}
            alt=""
            className="size-full object-cover"
            loading={priority ? "eager" : "lazy"}
          />
        ) : (
          <span className="flex size-full items-center justify-center text-primary-ink">
            <CategoryIcon
              icon={category?.icon ?? "wrench"}
              className="size-14"
            />
          </span>
        )}
        {m.is_demo ? (
          <span className="absolute left-2 top-2 rounded-full bg-card/95 px-2.5 py-1 text-xs font-bold text-muted-foreground">
            {t("masters.demo_badge")}
          </span>
        ) : null}
        {rating ? (
          <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-card/95 px-2.5 py-1 text-xs font-bold">
            <Star
              className="size-3.5 text-warning"
              fill="currentColor"
              aria-hidden
            />{" "}
            {Number(m.rating_avg).toFixed(1)}{" "}
            <span className="font-semibold text-muted-foreground">
              ({m.rating_count})
            </span>
          </span>
        ) : null}
        {m.experience_years > 0 ? (
          <span className="absolute bottom-2 right-2 rounded-full bg-primary px-2.5 py-1 text-xs font-bold text-primary-foreground">
            {t("masters.card.experience", { years: m.experience_years })}
          </span>
        ) : null}
      </Link>
      <div className="flex flex-1 flex-col gap-1.5 p-3.5">
        <h3 className="text-base font-bold leading-snug">
          <Link
            href={href}
            className="after:absolute after:inset-0 after:content-['']"
          >
            {m.display_name}
          </Link>
        </h3>
        <p className="line-clamp-2 text-sm text-foreground">{m.title}</p>
        <p className="flex items-center gap-1.5 text-sm text-primary-ink">
          <CategoryIcon icon={category?.icon ?? "wrench"} className="size-4" />{" "}
          {category ? name(category) : ""}
        </p>
        <ul className="mt-auto space-y-1 pt-1 text-sm text-muted-foreground">
          <li className="flex items-center gap-1.5">
            <MapPin className="size-4 shrink-0" aria-hidden />{" "}
            <span className="truncate">
              {region ? name(region) : t("masters.detail.whole_country")}
              {m.service_area ? ` · ${m.service_area}` : ""}
            </span>
          </li>
          {m.work_from && m.work_to ? (
            <li className="flex items-center gap-1.5">
              <Clock className="size-4 shrink-0" aria-hidden />{" "}
              {t("masters.card.hours", {
                from: hm(m.work_from),
                to: hm(m.work_to),
              })}
            </li>
          ) : null}
          <li className="flex items-center gap-1.5 font-semibold text-foreground">
            <BadgeCheck
              className="size-4 shrink-0 text-primary-ink"
              aria-hidden
            />{" "}
            {priceText(t, locale, m)}
          </li>
        </ul>
      </div>
    </article>
  );
}
