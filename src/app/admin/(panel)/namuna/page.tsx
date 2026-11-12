import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { getAdminContext } from "@/features/admin/context";
import { AdminPageHeader } from "@/features/admin/components/notes";
import { getDemoVacancyCount } from "@/features/demo-vacancies/queries";
import { DemoVacancyControls } from "@/features/demo-vacancies/components/admin-controls";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: `${t("demo.admin.nav")} · ${t("admin.shell.title")}` };
}

/**
 * /admin/namuna — namuna (demo) e'lonlar: nechta borligi, bir bosishda olib tashlash yoki qaytarish. Namuna vakansiyalar haqiqiy
 * e'lonlardan alohida jadvalda (0077). Usta e'lonlari namunalari — /admin/ustalar da. Huquq: vacancies.moderate.
 */
export default async function AdminDemoPage() {
  const ctx = await getAdminContext();
  if (!ctx.can("vacancies.moderate")) notFound();
  const [{ t }, count] = await Promise.all([getT(), getDemoVacancyCount()]);
  return (
    <div className="space-y-5" data-admin-demo>
      <AdminPageHeader title={t("demo.admin.title")} subtitle={t("demo.admin.subtitle")} />

      <section className="rounded-2xl border border-border bg-card p-4" aria-labelledby="demo-vacancies-admin">
        <h2 id="demo-vacancies-admin" className="text-base font-bold">
          {t("demo.admin.vacancies_title")}
        </h2>
        {count === null ? (
          // jadval yo'q = 0077 hali bazada yo'q (yoki baza javob bermadi): ishlamaydigan tugma o'rniga halol izoh
          <p role="status" data-demo-not-ready className="mt-2 rounded-xl bg-secondary p-3 text-sm font-semibold">
            {t("demo.admin.not_ready")}
          </p>
        ) : (
          <>
            <p className="mb-3 mt-1 text-sm text-muted-foreground" data-demo-count={count}>
              {count > 0 ? t("demo.admin.vacancies_desc", { count }) : t("demo.admin.vacancies_none")}
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <DemoVacancyControls count={count} />
              {count > 0 ? (
                <Link href="/jobs/namuna" className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-primary-ink hover:underline">
                  {t("demo.admin.open_list")} <ChevronRight className="size-4" aria-hidden />
                </Link>
              ) : null}
            </div>
          </>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-card p-4" aria-labelledby="demo-masters-admin">
        <h2 id="demo-masters-admin" className="text-base font-bold">
          {t("demo.admin.masters_title")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("demo.admin.masters_desc")}</p>
        <Link href="/admin/ustalar" className="mt-2 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-primary-ink hover:underline">
          {t("demo.admin.masters_link")} <ChevronRight className="size-4" aria-hidden />
        </Link>
      </section>
    </div>
  );
}
