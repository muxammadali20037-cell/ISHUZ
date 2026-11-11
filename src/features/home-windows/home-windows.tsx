import { publicEnv } from "@/lib/env";

/** Admin "Bosh sahifa" oynasi rasmi (2.0: oynalar saytda ko'rsatilmaydi; admin muharriri qayta qurilguncha qoladi) */
export function windowImageUrl(path: string): string {
  return `${publicEnv.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, "")}/storage/v1/object/public/${path}`;
}
