import "server-only";

import { unstable_cache } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";
import { ENTRY_MEDIA_KEY, parseEntryMedia, type EntryMedia } from "./media";

/** Kesh tegi: admin rasm yuklasa yoki olib tashlasa — updateTag(ENTRY_TAG) darhol yangilaydi */
export const ENTRY_TAG = "entry-media";

const load = unstable_cache(
  async (): Promise<EntryMedia> => {
    const { data, error } = await createPublicClient().from("app_settings").select("value").eq("key", ENTRY_MEDIA_KEY).maybeSingle();
    if (error) throw new Error(error.message);
    return parseEntryMedia(data?.value ?? null);
  },
  ["entry-media"],
  { revalidate: 300, tags: [ENTRY_TAG] },
);

/** Kirish ekranlari rasmlari (anon o'qiydi). Xato bo'lsa — o'rnatilgan tasvirlar */
export async function getEntryMedia(): Promise<EntryMedia> {
  try {
    return await load();
  } catch {
    return {};
  }
}
