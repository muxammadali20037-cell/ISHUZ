import Link from "next/link";
import { ArrowRight, BellPlus, Pencil, Target } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { jobsHref, parseJobsSearchParams, serializeJobsSearchParams } from "@/features/jobs/search-params";
import { findSavedSearchId } from "@/features/saved-searches/queries";
import { SaveSearchButton } from "@/features/saved-searches/components/save-search-button";
import { getProfessionTrail } from "../queries";

/**
 * Ishchi bosh sahifasi: "Aynan {Urolog} bo'yicha N ta vakansiya" yoki bo'sh holat —
 * "Hozir aynan Urolog bo'yicha vakansiya yo'q" + xabarnoma + o'xshash (ota tugun) variant.
 */
export async function ProfessionFocus({ workerId, categorySlug }: { workerId: string; categorySlug: string | null }) {
  const supabase = await createClient();
  const { data: w } = await supabase.from("worker_profiles").select("profession_node_id").eq("id", workerId).maybeSingle();
  const nodeId = w?.profession_node_id;
  if (!nodeId) {
    const { t } = await getT();
    return (
      <Link href="/profile/profession" className="group flex items-center gap-4 rounded-3xl bg-primary p-5 text-primary-foreground shadow-md transition-transform hover:-translate-y-0.5">
        <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-white/15">
          <Target className="size-7" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-lg font-extrabold">{t("professions.focus_pick_title")}</span>
          <span className="mt-0.5 block text-sm text-primary-foreground/85">{t("professions.focus_pick_desc")}</span>
        </span>
        <ArrowRight className="size-6 shrink-0 transition-transform group-hover:translate-x-1" />
      </Link>
    );
  }
  const [{ t, name }, trail, { data: subtree }] = await Promise.all([
    getT(),
    getProfessionTrail(nodeId),
    supabase.from("profession_nodes").select("id").contains("path", [nodeId]).limit(500),
  ]);
  const self = trail.at(-1);
  if (!self) return null;
  const ids = (subtree ?? []).map((n) => n.id);
  const { count } = await supabase.from("vacancies").select("id", { count: "exact", head: true }).eq("status", "active").in("profession_node_id", ids.length ? ids : [nodeId]);
  const label = name(self);
  const query = serializeJobsSearchParams({ q: label, category: categorySlug ?? "" });
  const parent = trail.length > 1 ? trail.at(-2)! : null;

  if (count) {
    return (
      <Link href={`/jobs?${query}`} className="flex items-center gap-3 rounded-2xl border border-primary/30 bg-primary-soft p-4 transition hover:border-primary">
        <Target className="size-6 shrink-0 text-primary" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">{t("professions.focus_found", { name: label, count })}</span>
          <span className="block truncate text-xs text-muted-foreground">{trail.map((x) => name(x)).join(" › ")}</span>
        </span>
        <ArrowRight className="size-5 text-primary" aria-hidden />
      </Link>
    );
  }


  return (
    <section className="rounded-2xl border border-dashed border-border p-5 text-center">
      <BellPlus className="mx-auto size-8 text-primary" aria-hidden />
      <h2 className="mt-2 font-semibold">{t("professions.focus_empty", { name: label })}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{t("professions.focus_empty_desc")}</p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <SaveSearchButton query={query} savedId={await findSavedSearchId(parseJobsSearchParams(new URLSearchParams(query)))} loggedIn />
        {parent ? (
          <Button asChild size="sm" variant="outline">
            <Link href={jobsHref({ q: name(parent), category: categorySlug ?? "" })}>{t("professions.focus_similar", { name: name(parent) })}</Link>
          </Button>
        ) : null}
        <Button asChild size="sm" variant="ghost">
          <Link href="/profile/profession">
            <Pencil className="size-4" /> {t("professions.change")}
          </Link>
        </Button>
        {categorySlug ? (
          <Button asChild size="sm" variant="ghost">
            <Link href={jobsHref({ category: categorySlug })}>{t("professions.focus_sector")}</Link>
          </Button>
        ) : null}
      </div>
    </section>
  );
}
