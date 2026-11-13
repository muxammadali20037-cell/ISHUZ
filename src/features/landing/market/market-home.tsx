import { Suspense } from "react";
import { getEntryMedia } from "@/features/entry/queries";
import { getHomeSettings } from "@/features/home-windows/queries";
import { getEntryStats } from "../entry-queries";
import { MarketHero } from "./hero";
import { PhotoCatalog } from "./catalog-section";
import { LatestJobs } from "./jobs-sections";
import { ListSkeleton } from "./sections";
import { MastersHomeSection } from "@/features/masters/components/masters-home-section";
import { getMarketCounts } from "./queries";

/**
 * Bosh sahifa — mehmon yoki rejim tanlamagan foydalanuvchi. 3.0 (2026-11-13, ega: "bosh sahifada faqat eng muhim narsalar"):
 * hero (ikki yo'l "Men ish qidiryapman / Menga ishchi kerak" va qidiruv) → ommabop kasblar (tezkor kategoriyalar) → yangi
 * vakansiyalar (bitta ro'yxat) → "Universal ustalar" (alohida yashil bo'lim) → footer.
 * Olib tashlandi (takror yoki ikkinchi darajali): "Tanlangan vakansiyalar" (yangilari bilan ikkinchi ro'yxat), ishonch bo'limi,
 * ish beruvchilar bloki (hero'dagi "Menga ishchi kerak"ni takrorlardi), "Qanday ishlaydi" (birinchi ochilishda /start
 * tanishtiruvida bor). Hamma son va ro'yxat — bazadan; bo'sh yoki xato bo'lsa — tushuntirish (soxta ma'lumot yo'q).
 * Rejim tanlangach — o'sha rolning bosh sahifasi (seeker-home / employer-home).
 */
export async function MarketHome() {
  const [stats, counts, media, home] = await Promise.all([getEntryStats(), getMarketCounts(), getEntryMedia(), getHomeSettings()]);
  return (
    <>
      <MarketHero stats={stats} counts={counts} media={media} ai={home.aiButton} />
      <PhotoCatalog media={media} counts={counts} />
      <Suspense fallback={<ListSkeleton />}>
        <LatestJobs />
      </Suspense>
      <div className="container-wide pb-10 sm:pb-14">
        <Suspense fallback={null}>
          <MastersHomeSection />
        </Suspense>
      </div>
    </>
  );
}
