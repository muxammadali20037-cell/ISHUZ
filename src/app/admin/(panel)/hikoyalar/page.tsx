import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { getAdminContext } from "@/features/admin/context";
import { AdminPageHeader, Forbidden } from "@/features/admin/components/notes";
import { StoriesEditor } from "@/features/admin/components/stories-editor";
import { STORY_COLS } from "@/features/stories/queries";
import type { StoryRow } from "@/features/stories/model";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: `${t("admin.nav.stories")} · ${t("admin.shell.title")}` };
}

/** Ro'yxat va o'qilgan vaqt (holat belgilari — "ko'rinmoqda / tugagan" — shu vaqt bo'yicha) */
async function loadStories() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("stories").select(STORY_COLS).order("sort_order", { ascending: true }).order("created_at", { ascending: false }).limit(100);
  return { stories: (data ?? []) as StoryRow[], failed: !!error, now: Date.now() };
}

/** "Ish topdim" hikoyalari (0079): bosh sahifa tepasidagi rasm/video — joylash, tartib, muddat, yoqish/o'chirish */
export default async function AdminStoriesPage() {
  const ctx = await getAdminContext();
  const { t } = await getT();
  if (!ctx.can("settings.manage")) return <Forbidden perm="settings.manage" />;
  const { stories, failed, now } = await loadStories();
  return (
    <div>
      <AdminPageHeader title={t("admin.stories.title")} subtitle={t("admin.stories.subtitle")} />
      {failed ? <p className="mb-4 rounded-xl border border-warning/40 bg-warning-soft px-4 py-3 text-sm">{t("admin.errors.needs_migration")}</p> : null}
      <StoriesEditor stories={stories} canManage={ctx.can("settings.manage")} now={now} />
    </div>
  );
}
