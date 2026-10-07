import Link from "next/link";
import { ChevronRight, LayoutGrid } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import type { Category } from "@/lib/reference";
import { CategoryIcon } from "@/components/shared/category-icon";
import { cn } from "@/lib/utils";
import { getProfessionTrail } from "../queries";

interface Direction {
  id: string;
  slug: string;
  name_uz: string;
  name_ru: string;
  name_en: string | null;
  icon: string | null;
  has_children: boolean;
  count: number;
}

/**
 * Soha tanlanganda — katta "yo'nalishlar" paneli: sohaning barcha yo'nalishlari (Tibbiyot → Shifokorlar, Hamshiralik,
 * Farmatsiya…) va har birida nechta vakansiya/nomzod borligi. Bosilsa — ichkariga (Shifokorlar → Kardiolog, Pediatr…),
 * natijalar ro'yxati ham shu yo'nalish bo'yicha filtrlanadi.
 */
export async function DirectionBrowser({
  kind,
  category,
  currentSlug,
  hrefFor,
}: {
  kind: "jobs" | "workers";
  category: Pick<Category, "id" | "slug" | "name_uz" | "name_ru" | "name_en" | "icon">;
  currentSlug: string | null;
  /** null — butun soha */
  hrefFor: (professionSlug: string | null) => string;
}) {
  const { t, name } = await getT();
  const supabase = await createClient();

  const current = currentSlug
    ? (await supabase.from("profession_nodes").select("id, slug, parent_id, name_uz, name_ru, name_en").eq("slug", currentSlug).eq("is_active", true).maybeSingle()).data
    : null;

  const load = async (parentId: string | null): Promise<Direction[]> => {
    if (kind === "jobs") {
      const { data } = await supabase.rpc("profession_direction_counts", { p_category_id: category.id, p_parent_id: parentId ?? undefined });
      return (data ?? []).map((d) => ({ ...d, count: Number(d.vacancies) }));
    }
    const { data } = await supabase.rpc("profession_direction_worker_counts", { p_category_id: category.id, p_parent_id: parentId ?? undefined });
    return (data ?? []).map((d) => ({ ...d, count: Number(d.workers) }));
  };

  // Joriy yo'nalish ichida bolalari bo'lsa — ularni, bo'lmasa (eng oxirgi kasb) — qo'shnilarini ko'rsatamiz
  let items = await load(current?.id ?? null);
  let level = current;
  if (current && !items.length) {
    items = await load(current.parent_id);
    level = current.parent_id ? ((await supabase.from("profession_nodes").select("id, slug, parent_id, name_uz, name_ru, name_en").eq("id", current.parent_id).maybeSingle()).data ?? null) : null;
  }
  if (!items.length && !current) return null;

  const trail = level ? await getProfessionTrail(level.id) : [];
  // Bir xil darajadagi yo'nalishlarni slug bo'yicha topish uchun
  const trailSlugs = trail.length
    ? (await supabase.from("profession_nodes").select("id, slug").in("id", trail.map((x) => x.id))).data ?? []
    : [];
  const slugOf = new Map(trailSlugs.map((x) => [x.id, x.slug]));

  const withCount = items.filter((d) => d.count > 0);
  const empty = items.filter((d) => d.count === 0);
  const countLabel = (n: number) => t(kind === "jobs" ? "jobs.directions.vacancies" : "jobs.directions.workers", { count: n });

  const card = (d: Direction) => {
    const active = d.slug === currentSlug;
    return (
      <li key={d.id}>
        <Link
          href={hrefFor(d.slug)}
          aria-current={active ? "true" : undefined}
          className={cn(
            "flex min-h-16 items-center gap-3 rounded-2xl border p-3 transition-colors",
            active ? "border-primary bg-primary-soft" : "border-border bg-card hover:border-primary/50",
            d.count === 0 && !active && "opacity-70",
          )}
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
            <CategoryIcon name={d.icon ?? category.icon} className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold leading-snug">{name(d)}</span>
            <span className={cn("block text-sm", d.count ? "font-medium text-primary" : "text-muted-foreground")}>{countLabel(d.count)}</span>
          </span>
          {d.has_children ? <ChevronRight className="size-5 shrink-0 text-muted-foreground" /> : null}
        </Link>
      </li>
    );
  };

  return (
    <section className="mt-4 rounded-3xl border border-border bg-secondary/40 p-4 sm:p-5" aria-label={t("jobs.directions.title")}>
      {/* Yo'l: Tibbiyot › Shifokorlar › ... */}
      <nav className="mb-3 flex flex-wrap items-center gap-1 text-sm" aria-label={t("jobs.directions.path")}>
        <Link href={hrefFor(null)} className={cn("inline-flex items-center gap-1.5 font-bold", currentSlug ? "text-primary hover:underline" : "text-foreground")}>
          <CategoryIcon name={category.icon} className="size-4" /> {name(category)}
        </Link>
        {trail.map((x) => {
          const s = slugOf.get(x.id);
          return (
            <span key={x.id} className="inline-flex items-center gap-1">
              <ChevronRight className="size-4 text-muted-foreground" />
              {s ? (
                <Link href={hrefFor(s)} className={cn(s === currentSlug ? "font-semibold text-foreground" : "text-primary hover:underline")}>
                  {name(x)}
                </Link>
              ) : (
                <span>{name(x)}</span>
              )}
            </span>
          );
        })}
      </nav>

      <h2 className="mb-3 flex items-center gap-2 text-lg font-bold">
        <LayoutGrid className="size-5 text-primary" />
        {level ? t("jobs.directions.inside", { name: name(level) }) : t("jobs.directions.title")}
      </h2>

      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{withCount.map(card)}</ul>
      {empty.length ? (
        <details className="mt-2" open={!withCount.length}>
          <summary className="cursor-pointer select-none py-2 text-sm font-medium text-muted-foreground hover:text-foreground">
            {t("jobs.directions.more", { count: empty.length })}
          </summary>
          <ul className="mt-1 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{empty.map(card)}</ul>
        </details>
      ) : null}
    </section>
  );
}
