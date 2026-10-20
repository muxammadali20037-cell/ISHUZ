import { Suspense } from "react";
import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import type { SessionContext } from "@/features/auth/session";
import { getEntryMedia } from "@/features/entry/queries";
import { getHomeSettings } from "@/features/home-windows/queries";
import { getEntryStats } from "../entry-queries";
import { MarketHero } from "./hero";
import { AiShowcase } from "./ai-showcase";
import { CategoryGrid, EmployerBand, HowItWorks, LatestJobsSection, LatestJobsSkeleton, MarketStats, TrustStrip, WhyUs, WorkersPreview } from "./sections";
import { getMarketCounts } from "./queries";
import type { LatestTab } from "./model";

/**
 * Bosh sahifa — mehmon yoki rejim tanlamagan foydalanuvchi (marketplace ko'rinishi):
 * hero (sarlavha, "Ish qidiraman" / "Xodim qidiraman", qidiruv paneli, tezkor filtrlar) → ishonch qatori → sohalar (haqiqiy
 * sonlar) → yangi ishlar (filtrlar URL'da) → AI yordamchi → ish beruvchilar → ishchilar → qanday ishlaydi → nega Ish topdim → raqamlar.
 * Hamma son va ro'yxat — bazadan; xato bo'lsa son ko'rsatilmaydi yoki tushuntirish va "Qayta urinish" chiqadi.
 * Rejim tanlangach — o'sha rolning bosh sahifasi (seeker-home / employer-home), avvalgidek.
 */
export async function MarketHome({ session, tab }: { session: SessionContext | null; tab: LatestTab }) {
  const [{ t }, stats, counts, media, home] = await Promise.all([getT(), getEntryStats(), getMarketCounts(), getEntryMedia(), getHomeSettings()]);
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
      <WhyUs />
      <MarketStats stats={stats} counts={counts} />
      {session ? null : (
        <p className="container-app flex flex-wrap items-center justify-center gap-x-2 pb-4 text-base text-muted-foreground">
          {t("welcome.entry.have_account")}
          <Link href="/auth" className="inline-flex min-h-11 items-center px-1 font-bold text-primary hover:underline">
            {t("welcome.entry.login")}
          </Link>
        </p>
      )}
    </>
  );
}
