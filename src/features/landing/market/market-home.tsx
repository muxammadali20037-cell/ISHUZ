import { Suspense } from "react";
import { getEntryMedia } from "@/features/entry/queries";
import { getHomeSettings } from "@/features/home-windows/queries";
import { getEntryStats } from "../entry-queries";
import { MarketHero } from "./hero";
import { PhotoCatalog } from "./catalog-section";
import { FeaturedJobs, LatestJobs, TrustedEmployers } from "./jobs-sections";
import { EmployerBand, HowItWorks, ListSkeleton } from "./sections";
import { getMarketCounts } from "./queries";

/**
 * Bosh sahifa — mehmon yoki rejim tanlamagan foydalanuvchi (2026-11-05, egasi bergan tartib):
 * hero (katta haqiqiy surat, ikki yo'l, uch maydonli qidiruv) → ommabop kasblar (suratli katalog) → tanlangan vakansiyalar
 * (to'r) → yangi vakansiyalar (ro'yxat) → ishonchli ish beruvchilar va himoya qoidalari → ish beruvchilar uchun → qanday
 * ishlaydi → footer. Hamma son va ro'yxat — bazadan; bo'sh yoki xato bo'lsa — bo'lim yo'q yoki tushuntirish (soxta ma'lumot yo'q).
 * Rejim tanlangach — o'sha rolning bosh sahifasi (seeker-home / employer-home), avvalgidek.
 */
export async function MarketHome() {
  const [stats, counts, media, home] = await Promise.all([getEntryStats(), getMarketCounts(), getEntryMedia(), getHomeSettings()]);
  return (
    <>
      <MarketHero stats={stats} counts={counts} media={media} ai={home.aiButton} />
      <PhotoCatalog media={media} counts={counts} />
      <Suspense fallback={<ListSkeleton grid />}>
        <FeaturedJobs />
      </Suspense>
      <Suspense fallback={<ListSkeleton />}>
        <LatestJobs />
      </Suspense>
      <Suspense fallback={null}>
        <TrustedEmployers />
      </Suspense>
      <EmployerBand />
      <HowItWorks />
    </>
  );
}
