import { Suspense } from "react";
import type { SessionContext } from "@/features/auth/session";
import { getEntryMedia } from "@/features/entry/queries";
import { getHomeSettings } from "@/features/home-windows/queries";
import { getEntryStats } from "../entry-queries";
import { MarketHero } from "./hero";
import { AiShowcase } from "./ai-showcase";
import { CategoryGrid, EmployerBand, FinalCta, HowItWorks, LatestJobsSection, LatestJobsSkeleton, MarketStats, TrustStrip, WorkersPreview } from "./sections";
import { getMarketCounts } from "./queries";
import type { LatestTab } from "./model";

/**
 * Bosh sahifa — mehmon yoki rejim tanlamagan foydalanuvchi (marketplace ko'rinishi):
 * hero (sarlavha, "Ish qidiraman" / "Xodim qidiraman", qidiruv paneli, tezkor filtrlar) → ishonch qatori → sohalar (haqiqiy
 * sonlar) → yangi ishlar (filtrlar URL'da) → AI yordamchi → ish beruvchilar → ishchilar → qanday ishlaydi (4+4 qadam) → raqamlar →
 * yakuniy chaqiruv ("Yangi imkoniyatlar sizni kutmoqda"). 2026-10-31: "Nega Ish topdim?" olib tashlandi (ishonch qatorini takrorlardi).
 * Hamma son va ro'yxat — bazadan; xato bo'lsa son ko'rsatilmaydi yoki tushuntirish va "Qayta urinish" chiqadi.
 * Rejim tanlangach — o'sha rolning bosh sahifasi (seeker-home / employer-home), avvalgidek.
 */
export async function MarketHome({ session, tab }: { session: SessionContext | null; tab: LatestTab }) {
  const [stats, counts, media, home] = await Promise.all([getEntryStats(), getMarketCounts(), getEntryMedia(), getHomeSettings()]);
  return (
    <>
      <MarketHero stats={stats} media={media} ai={home.aiButton} />
      <TrustStrip />
      <CategoryGrid counts={counts} />
      <Suspense fallback={<LatestJobsSkeleton />}>
        <LatestJobsSection session={session} tab={tab} />
      </Suspense>
      {/* AI yordamchi — platformaning farqi (admin AI tugmasini o'chirsa — bo'lim ham yo'q) */}
      {home.aiButton ? <AiShowcase /> : null}
      <EmployerBand />
      <Suspense fallback={null}>
        <WorkersPreview />
      </Suspense>
      <HowItWorks />
      <MarketStats stats={stats} counts={counts} />
      <FinalCta />
    </>
  );
}
