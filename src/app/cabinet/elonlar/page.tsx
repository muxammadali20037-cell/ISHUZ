import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { cn } from "@/lib/utils";
import { requireSession } from "@/features/auth/session";
import { getMode } from "@/features/mode/server";
import { Shell } from "@/components/shared/shell";
import { getMyListings } from "@/features/cabinet/queries";
import { getMyMasterListings } from "@/features/masters/queries";
import { MyListingsSection } from "@/features/cabinet/components/my-listings";
import { LISTING_BUCKETS, bucketSlug, masterBucket, parseBucket, vacancyBucket, workerBucket } from "@/features/cabinet/listing-buckets";
import { RoleSwitchRow } from "@/features/landing/role-switch-row";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("easy.home2.my_listings"), robots: { index: false } };
}

/**
 * /cabinet/elonlar — "E'lonlarim" (pastki menyuning 2-bo'limi). Ega, 2026-11-21 (master prompt): tepada 3 ta yorliq —
 * Faol · Yopilgan · Muddati tugagan (?holat=faol|yopilgan|tugagan, JS'siz oddiy havolalar), har birida soni. Pastda
 * menyudan bu yerga ko'chgan "Sizga mos" (ish izlovchida).
 */
export default async function MyListingsPage({ searchParams }: { searchParams: Promise<{ holat?: string | string[] }> }) {
  const session = await requireSession("/cabinet/elonlar");
  const [{ t }, mine, allMasters, mode, sp] = await Promise.all([getT(), getMyListings(session), getMyMasterListings(session.userId), getMode(), searchParams]);
  // rollar aralashmaydi (ega, 2026-11-20): ish beruvchi rejimida faqat vakansiyalar, ish izlovchida — o'zi haqidagi va
  // usta e'lonlari (rejim hali tanlanmagan bo'lsa — hammasi)
  const employer = mode === "employer";
  const worker = mode === "worker";
  const workers = employer ? [] : mine.workers;
  const vacancies = worker ? [] : mine.vacancies;
  const masters = employer ? [] : allMasters;
  const bucket = parseBucket(sp.holat);

  const inBucket = {
    workers: (b: string) => workers.filter((w) => workerBucket({ status: w.status, listedUntil: w.listedUntil, moderationState: w.moderation.state }) === b),
    vacancies: (b: string) => vacancies.filter((v) => vacancyBucket(v.status) === b),
    masters: (b: string) => masters.filter((m) => masterBucket(m.status) === b),
  };
  const count = (b: string) => inBucket.workers(b).length + inBucket.vacancies(b).length + inBucket.masters(b).length;
  const shown = { workers: inBucket.workers(bucket), vacancies: inBucket.vacancies(bucket), masters: inBucket.masters(bucket) };
  const none = !workers.length && !vacancies.length && !masters.length;
  const shownEmpty = !shown.workers.length && !shown.vacancies.length && !shown.masters.length;
  // boshqa roldagi e'lonlar ko'rsatilmaydi — faqat soni va bir bosishda o'sha rolga o'tish (e'lon "yo'qolib qoldi" deb o'ylamasin)
  const otherCount = employer ? mine.workers.length + allMasters.length : worker ? mine.vacancies.length : 0;
  // ishchi e'loni — chatning o'zida (3-bosqich); vakansiya — yordamchi bilan alohida ekran
  const postHref = employer ? "/post/vacancy?ai=1" : "/chat?post=new";

  return (
    <Shell>
      <div className="container-narrow space-y-4 py-6 text-lg sm:py-8" data-my-listings-page data-bucket={bucket}>
        <h1 className="text-page font-extrabold tracking-tight sm:text-page-lg">{t("easy.home2.my_listings")}</h1>

        {/* yorliqlar: Faol · Yopilgan · Muddati tugagan */}
        <nav aria-label={t("easy.cabinet.buckets_label")} className="flex gap-1 rounded-xl bg-secondary p-1" data-listing-buckets>
          {LISTING_BUCKETS.map((b) => {
            const active = b === bucket;
            const n = count(b);
            return (
              <Link
                key={b}
                href={b === "active" ? "/cabinet/elonlar" : `/cabinet/elonlar?holat=${bucketSlug(b)}`}
                scroll={false}
                aria-current={active ? "page" : undefined}
                data-bucket-tab={b}
                className={cn(
                  // tor ekranda (320 px) soni nom ostiga tushadi — nom kesilmaydi
                  "press flex min-h-11 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg px-2 text-sm font-semibold max-[359px]:flex-col max-[359px]:gap-0 max-[359px]:px-1 max-[359px]:py-1",
                  active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <span className="truncate">{t(`easy.cabinet.bucket_${b}`)}</span>
                <span className={cn("shrink-0 rounded-md px-1.5 text-xs font-bold", active ? "bg-primary-soft text-primary-ink" : "bg-card/70")}>{n}</span>
              </Link>
            );
          })}
        </nav>

        {none ? (
          <p className="rounded-2xl bg-secondary p-4 text-base text-muted-foreground" data-my-listings-empty>
            {t("easy.cabinet.no_listings")}
          </p>
        ) : shownEmpty ? (
          <p className="rounded-2xl bg-secondary p-4 text-base text-muted-foreground" data-bucket-empty>
            {t(`easy.cabinet.empty_${bucket}`)}
          </p>
        ) : (
          <MyListingsSection workers={shown.workers} vacancies={shown.vacancies} paid={mine.paid} masters={shown.masters} addMore={bucket === "active"} />
        )}

        {none || (bucket === "active" && !shown.workers.length) ? (
          <Link
            href={postHref}
            prefetch={false}
            data-track="post_start"
            data-track-to="my_listings"
            data-my-listings-post
            className="press flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary-soft px-4 text-base font-bold text-primary-ink hover:bg-primary/15"
          >
            <Plus className="size-5" strokeWidth={2.6} aria-hidden />
            {employer ? t("easy.matches.employer_cta") : t("easy.home2.post_cta")}
          </Link>
        ) : null}

        {/* "Sizga mos" bo'limi yo'q (ega, 2026-11-22: "moslik umuman kerak emas"). Arizalar yo'q — bog'lanish faqat telefon orqali */}
        {otherCount ? (
          <RoleSwitchRow
            tone="neutral"
            to="/cabinet/elonlar"
            target={employer ? "worker" : "employer"}
            title={t(employer ? "easy.side.switch.to_worker" : "easy.side.switch.to_employer")}
            hint={t(employer ? "easy.cabinet.other_role_worker" : "easy.cabinet.other_role_employer", { count: otherCount })}
          />
        ) : null}
      </div>
    </Shell>
  );
}
