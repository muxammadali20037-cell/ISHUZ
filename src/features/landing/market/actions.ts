"use server";

import { redirect } from "next/navigation";
import { getRegions } from "@/lib/reference";
import { heroSearchHref } from "./model";

const field = (form: FormData, key: string) => {
  const v = form.get(key);
  return typeof v === "string" ? v.slice(0, 200) : "";
};

/**
 * Bosh sahifa qidiruv paneli (JS'siz ham ishlaydi): qiymatlar serverda tekshiriladi (viloyat — ma'lumotnomadan,
 * tur va maosh — ruxsat etilgan ro'yxatdan) va mavjud /search oqimiga yo'naltiriladi.
 */
export async function homeSearch(form: FormData): Promise<void> {
  const regions = await getRegions();
  redirect(
    heroSearchHref(
      { q: field(form, "q"), region: field(form, "region"), type: field(form, "type"), salary: field(form, "salary") },
      regions.map((r) => r.slug),
    ),
  );
}
