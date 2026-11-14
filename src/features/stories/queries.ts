import "server-only";

import { unstable_cache } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";
import { forAudience, isLive, toStory, type Story, type StoryRow } from "./model";

/** Kesh tegi: admin hikoya qo'shsa/o'zgartirsa — updateTag(STORIES_TAG) darhol yangilaydi */
export const STORIES_TAG = "stories";

export const STORY_COLS =
  "id, title, caption, media_kind, media_path, poster_path, cta_label, cta_url, audience, duration_sec, is_active, starts_at, ends_at, sort_order, created_at";

const load = unstable_cache(
  async (): Promise<StoryRow[]> => {
    // RLS: anon faqat yoqilgan va muddati ichidagilarni ko'radi
    const { data, error } = await createPublicClient()
      .from("stories")
      .select(STORY_COLS)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) throw new Error(error.message);
    return (data ?? []) as StoryRow[];
  },
  ["stories-live"],
  { revalidate: 300, tags: [STORIES_TAG] },
);

/** Hozir ko'rinadigan hikoyalar (rejimga mos). Xato yoki 0079 qo'llanmagan bo'lsa — bo'sh (bosh sahifa buzilmaydi) */
export async function getLiveStories(mode: "seeker" | "employer" | null): Promise<Story[]> {
  try {
    const now = Date.now();
    return forAudience(
      (await load()).filter((r) => isLive(r, now)),
      mode,
    )
      .map(toStory)
      .filter((s): s is Story => s !== null)
      .slice(0, 20);
  } catch {
    return [];
  }
}
