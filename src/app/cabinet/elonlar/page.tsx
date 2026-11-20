import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { requireSession } from "@/features/auth/session";
import { getMode } from "@/features/mode/server";
import { Shell } from "@/components/shared/shell";
import { getMyListings } from "@/features/cabinet/queries";
import { getMyMasterListings } from "@/features/masters/queries";
import { MyListingsSection } from "@/features/cabinet/components/my-listings";
import { RoleSwitchRow } from "@/features/landing/role-switch-row";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("easy.home2.my_listings"), robots: { index: false } };
}

/**
 * /cabinet/elonlar — "E'lonlarim": o'zi joylagan e'lonlar (o'zi haqida, vakansiyalar, usta e'lonlari) va ularning haqiqiy
 * holati, amallar bilan (ega, 2026-11-17: "e'lonlarim — bossa o'zi joylagan e'lonlar ichiga kirsin, holatlarini ko'rsin").
 * Bosh sahifadagi "E'lonlarim" qatoridan ochiladi; Profildagi "Mening e'lonlarim" bo'limi bilan bir xil ko'rinish.
 */
export default async function MyListingsPage() {
  const session = await requireSession("/cabinet/elonlar");
  const [{ t }, mine, allMasters, mode] = await Promise.all([getT(), getMyListings(session), getMyMasterListings(session.userId), getMode()]);
  // rollar aralashmaydi (ega, 2026-11-20: "bitta odam ham ishchi, ham ish beruvchi bo'lsa — adashmasin, bir-biriga ko'rinmasin"):
  // ish beruvchi rejimida faqat vakansiyalar, ish izlovchida — o'zi haqidagi va usta e'lonlari
  // (rejim hali tanlanmagan bo'lsa — hammasi)
  const employer = mode === "employer";
  const worker = mode === "worker";
  const workers = employer ? [] : mine.workers;
  const vacancies = worker ? [] : mine.vacancies;
  const masters = employer ? [] : allMasters;
  const paid = mine.paid;
  const empty = !workers.length && !vacancies.length && !masters.length;
  // boshqa roldagi e'lonlar ko'rsatilmaydi — faqat soni va bir bosishda o'sha rolga o'tish (e'lon "yo'qolib qoldi" deb o'ylamasin)
  const otherCount = employer ? mine.workers.length + allMasters.length : worker ? mine.vacancies.length : 0;
  return (
    <Shell>
      <div className="container-narrow space-y-4 py-6 text-lg sm:py-8" data-my-listings-page>
        <div>
          <h1 className="text-page font-extrabold tracking-tight sm:text-page-lg">{t("easy.home2.my_listings")}</h1>
          <p className="mt-1 text-base text-muted-foreground">{t("easy.cabinet.page_sub")}</p>
        </div>
        <MyListingsSection workers={workers} vacancies={vacancies} paid={paid} masters={masters} addMore />
        {empty ? (
          <Link
            href={employer ? "/post/vacancy?ai=1" : "/ai/post"}
            prefetch={false}
            data-track="post_start"
            data-track-to="my_listings"
            className="press flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary-soft px-4 text-base font-bold text-primary-ink hover:bg-primary/15"
          >
            <Plus className="size-5" strokeWidth={2.6} aria-hidden />
            {employer ? t("easy.matches.employer_cta") : t("easy.home2.post_cta")}
          </Link>
        ) : null}
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
