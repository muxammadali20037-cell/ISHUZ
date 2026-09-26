import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import { getCategories } from "@/lib/reference";
import { CategoryIcon } from "@/components/shared/category-icon";
import { SectionHeader } from "@/components/ui/misc";

/** Kategoriyalar to'ri → /jobs?category=slug */
export async function CategoryGrid() {
  const [{ t, name }, categories] = await Promise.all([getT(), getCategories()]);
  if (!categories.length) return null;
  return (
    <section aria-label={t("jobs.home.categories")}>
      <SectionHeader title={t("jobs.home.categories")} href="/jobs" linkLabel={t("common.actions.view_all")} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {categories.map((c) => (
          <Link
            key={c.id}
            href={`/jobs?category=${c.slug}`}
            className="flex min-h-[60px] items-center gap-3 rounded-2xl border border-border/70 bg-card p-3.5 shadow-sm transition-colors hover:border-primary/40 hover:bg-primary-soft/40"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
              <CategoryIcon name={c.icon} className="size-5" />
            </span>
            <span className="text-sm font-medium leading-tight">{name(c)}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
