import Link from "next/link";
import { ChevronRight, FileText, Gift, Target, type LucideIcon } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { getProfessionTrail } from "@/features/professions/queries";

/** Profil tepasidagi yirik havolalar: Kasblarim (joriy kasb yo'li bilan), Arizalarim, Takliflar */
export async function ProfileShortcuts({ workerId }: { workerId: string }) {
  const supabase = await createClient();
  const [{ t, name }, { data: w }, { count: extras }] = await Promise.all([
    getT(),
    supabase.from("worker_profiles").select("profession_node_id").eq("id", workerId).maybeSingle(),
    supabase.from("worker_professions").select("node_id", { count: "exact", head: true }).eq("worker_id", workerId),
  ]);
  const trail = await getProfessionTrail(w?.profession_node_id);
  const profession = trail.at(-1) ? name(trail.at(-1)!) + (extras ? ` +${extras}` : "") : t("professions.focus_pick_title");
  const items: { href: string; icon: LucideIcon; title: string; desc: string; hot?: boolean }[] = [
    { href: "/profile/profession", icon: Target, title: t("professions.my_card"), desc: profession, hot: !trail.length },
    { href: "/applications", icon: FileText, title: t("common.nav.applications"), desc: t("jobs.home.stats_applications") },
    { href: "/offers", icon: Gift, title: t("common.nav.offers"), desc: t("jobs.home.stats_offers") },
  ];
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {items.map((i) => (
        <Link
          key={i.href}
          href={i.href}
          className={`flex items-center gap-3 rounded-2xl border p-4 shadow-sm transition-colors hover:border-primary/50 ${i.hot ? "border-primary bg-primary-soft/50" : "border-border bg-card"}`}
        >
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
            <i.icon className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">{i.title}</span>
            <span className="block truncate text-sm text-muted-foreground">{i.desc}</span>
          </span>
          <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
        </Link>
      ))}
    </div>
  );
}
