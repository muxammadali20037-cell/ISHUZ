import "server-only";

import { unstable_cache } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";
import { parseWindows, type HomeWindow } from "./model";

/** Kesh tegi: admin oynalarni yoki lupa tugmasini o'zgartirsa — updateTag(HOME_TAG) darhol yangilaydi */
export const HOME_TAG = "home-settings";

export interface HomeSettings {
  windows: HomeWindow[];
  /** o'ng pastdagi "O'zingizga mosini toping" lupa tugmasi */
  aiButton: boolean;
}

const load = unstable_cache(
  async (): Promise<HomeSettings> => {
    const { data, error } = await createPublicClient().from("app_settings").select("key, value").in("key", ["home_banners", "ai_search_button"]);
    if (error) throw new Error(error.message);
    const map = new Map((data ?? []).map((r) => [r.key, r.value]));
    return { windows: parseWindows(map.get("home_banners")), aiButton: map.get("ai_search_button") !== false };
  },
  ["home-settings"],
  { revalidate: 300, tags: [HOME_TAG] },
);

/** Ochiq sozlamalar (anon o'qiydi). Xato yoki 0060 bo'lmasa — standart oynalar, tugma yoqilgan */
export async function getHomeSettings(): Promise<HomeSettings> {
  try {
    return await load();
  } catch {
    return { windows: parseWindows(null), aiButton: true };
  }
}
