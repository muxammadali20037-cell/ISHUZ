import Link from "next/link";
import { ChevronRight, FlaskConical } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { cn } from "@/lib/utils";
import { getDemoVacancies } from "../queries";
import { DemoJobCard } from "./demo-job-card";

/**
 * "Namuna e'lonlar" bloki — haqiqiy e'lon bo'lmagan (yoki juda kam) joyda: bosh sahifa ro'yxati ostida, qidiruvning bo'sh
 * holatida. Haqiqiy ro'yxat bilan aralashmaydi: alohida sarlavha, izoh va kesik hoshiyali kartalar.
 * Namunalar yo'q (olib tashlangan yoki 0077 qo'llanmagan) — hech narsa chizilmaydi.
 */
export async function DemoVacanciesBlock({
  category = null,
  categoryName = null,
  region = null,
  limit = 6,
  className,
  columns = "md:grid-cols-2",
}: {
  category?: string | null;
  categoryName?: string | null;
  region?: string | null;
  limit?: number;
  className?: string;
  /** kartalar to'ri (chaqiruvchi sahifaning ro'yxatiga mos) */
  columns?: string;
}) {
  const [{ t }, list] = await Promise.all([getT(), getDemoVacancies({ category, region, limit })]);
  if (!list.items.length) return null;
  const allHref = category ? `/jobs/namuna?soha=${encodeURIComponent(category)}` : "/jobs/namuna";
  return (
    <section aria-labelledby="demo-vacancies-title" className={cn("min-w-0", className)} data-demo-block>
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="demo-vacancies-title" className="flex min-w-0 items-center gap-1.5 text-lg font-bold leading-tight">
          <FlaskConical className="size-5 shrink-0 text-muted-foreground" aria-hidden /> {t("demo.block_title")}
        </h2>
        {list.total > list.items.length ? (
          <Link href={allHref} prefetch={false} className="-my-2 inline-flex min-h-11 shrink-0 items-center gap-0.5 text-base font-semibold text-primary-ink hover:underline">
            {t("demo.see_all")} <ChevronRight className="size-4" aria-hidden />
          </Link>
        ) : null}
      </div>
      <p className="mt-1 text-sm text-muted-foreground" data-demo-note>
        {category && categoryName ? t("demo.block_note_category", { category: categoryName }) : t("demo.block_note")}
      </p>
      <ul className={cn("mt-3 grid grid-cols-1 gap-3", columns)}>
        {list.items.map((job) => (
          <li key={job.id} className="flex [&>article]:w-full">
            <DemoJobCard job={job} />
          </li>
        ))}
      </ul>
    </section>
  );
}
