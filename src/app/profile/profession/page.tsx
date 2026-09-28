import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { getCategories } from "@/lib/reference";
import { createClient } from "@/lib/supabase/server";
import { requireWorker } from "@/features/auth/session";
import { Shell } from "@/components/shared/shell";
import { getProfessionTrail } from "@/features/professions/queries";
import { MyProfessions, type ExtraProfession } from "@/features/professions/components/my-professions";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("professions.my_title"), robots: { index: false } };
}

/** /profile/profession — asosiy va qo'shimcha kasblar (bitta umumiy kasblar daraxtidan) */
export default async function MyProfessionPage() {
  const session = await requireWorker("/profile/profession");
  const supabase = await createClient();
  const [{ t }, categories, { data: w }, { data: extras }] = await Promise.all([
    getT(),
    getCategories(),
    supabase.from("worker_profiles").select("profession_node_id, category_id").eq("id", session.workerId).maybeSingle(),
    supabase.from("worker_professions").select("node_id, experience_level, node:profession_nodes(category_id)").eq("worker_id", session.workerId).order("created_at"),
  ]);
  const [primaryTrail, ...extraTrails] = await Promise.all([getProfessionTrail(w?.profession_node_id), ...(extras ?? []).map((x) => getProfessionTrail(x.node_id))]);
  const primary = w?.profession_node_id && w.category_id && primaryTrail.length ? { id: w.profession_node_id, categoryId: w.category_id, trail: primaryTrail } : null;
  const extraItems: ExtraProfession[] = (extras ?? []).map((x, i) => ({ id: x.node_id, categoryId: x.node?.category_id ?? "", trail: extraTrails[i] ?? [], experience: x.experience_level }));

  return (
    <Shell>
      <div className="container-narrow py-5 sm:py-8">
        <Link href="/profile" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="size-4" /> {t("common.nav.profile")}
        </Link>
        <h1 className="mb-6 text-2xl font-extrabold">{t("professions.my_title")}</h1>
        <MyProfessions categories={categories} primary={primary} extras={extraItems} />
      </div>
    </Shell>
  );
}
