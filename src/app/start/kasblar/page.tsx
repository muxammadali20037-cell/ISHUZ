import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { getT } from "@/lib/i18n/server";
import { getCategories } from "@/lib/reference";
import { createClient } from "@/lib/supabase/server";
import type { PickedProfession } from "@/features/professions/types";
import { saveProfessionPrefs } from "@/features/entry/actions";
import { PREFS_COOKIE, parsePrefs } from "@/features/entry/prefs";
import { EntryBack, EntryHeading, EntryScreen } from "@/features/entry/components/entry-screen";
import { EntrySteps } from "@/features/entry/components/entry-steps";
import { ProfessionMultiPick } from "@/features/entry/components/profession-multi-pick";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("welcome.entry.professions.title"), robots: { index: false } };
}

/**
 * 05 · "Qaysi kasblar sizga mos keladi?" (ega "MASTER PROMPT", 2026-11-16): ish qidiruvchi rolni tanlagach — bir nechta kasb
 * (soha bo'yicha yoki qidiruv bilan), 5 tagacha. Kirish talab qilinmaydi: tanlov shu qurilmada (ib_prefs). Ixtiyoriy.
 */
export default async function ProfessionsStepPage() {
  const [{ t }, categories, jar] = await Promise.all([getT(), getCategories(), cookies()]);
  const ids = parsePrefs(jar.get(PREFS_COOKIE)?.value).professions;
  let initial: PickedProfession[] = [];
  if (ids.length) {
    const supabase = await createClient();
    const { data } = await supabase.from("profession_nodes").select("id, category_id, name_uz, name_ru, name_en").in("id", ids).eq("is_active", true);
    const byId = new Map((data ?? []).map((n) => [n.id, n]));
    initial = ids.flatMap((id) => {
      const n = byId.get(id);
      return n ? [{ id: n.id, categoryId: n.category_id, trail: [{ id: n.id, name_uz: n.name_uz, name_ru: n.name_ru, name_en: n.name_en }] }] : [];
    });
  }
  return (
    <EntryScreen
      left={
        <div className="flex items-center">
          <EntryBack href="/start/rol?from=welcome" label={t("common.actions.back")} />
          <EntrySteps current={1} total={2} label={t("welcome.entry.professions.step", { current: 1, total: 2 })} />
        </div>
      }
      right={
        <Link href="/start/hudud" className="inline-flex min-h-11 items-center px-3 text-sm font-semibold text-muted-foreground hover:text-foreground" data-testid="step-skip">
          {t("welcome.entry.professions.skip")}
        </Link>
      }
    >
      <EntryHeading className="pt-2" title={t("welcome.entry.professions.title")} subtitle={t("welcome.entry.professions.subtitle")} />
      <form action={saveProfessionPrefs} className="flex flex-1 flex-col" data-professions-form>
        <ProfessionMultiPick categories={categories} initial={initial} />
      </form>
    </EntryScreen>
  );
}
