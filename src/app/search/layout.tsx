import type { ReactNode } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { SEARCH_URL_HEADER, modeHref, parseFindParams } from "@/features/find/params";
import { getMode } from "@/features/mode/server";
import { findModeOf } from "@/features/mode/mode";

/**
 * Rejim tanlangan, URL'da maqsad yo'q (/search) — shu rejimning qidiruviga yo'naltirish shu yerda, loading.tsx chegarasidan
 * oldin: javob oqimi hali boshlanmagan, shuning uchun haqiqiy 307. Sahifa ichida bo'lsa — 200 + <meta refresh> va brauzer
 * sahifani ikki marta yuklaydi (shu orada bosilgan havola esa bekor bo'ladi).
 * URL so'rov qismini proxy beradi; layout faqat /search'ga boshqa sahifadan kirilganda chiziladi — /search ichidagi
 * o'tishlarda yo'naltirishni sahifaning o'zi bajaradi (u holda mijoz routeri, qayta yuklashsiz).
 */
export default async function SearchLayout({ children }: { children: ReactNode }) {
  const search = (await headers()).get(SEARCH_URL_HEADER);
  if (search !== null) {
    const mode = await getMode();
    const target = modeHref(parseFindParams(Object.fromEntries(new URLSearchParams(search))), mode ? findModeOf(mode) : null);
    if (target) redirect(target);
  }
  return children;
}
