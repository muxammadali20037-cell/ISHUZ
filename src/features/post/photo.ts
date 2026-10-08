import { publicEnv } from "@/lib/env";

/** vacancy-photos bucket yo'li → ochiq URL (server va mijozda ishlaydi) */
export function vacancyPhotoUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  return `${publicEnv.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, "")}/storage/v1/object/public/vacancy-photos/${path.split("/").map(encodeURIComponent).join("/")}`;
}
