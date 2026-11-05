import type { StaticImageData } from "next/image";
import heroConstruction from "@/assets/photos/hero-construction.jpg";
import medicine from "@/assets/photos/cat-medicine.jpg";
import education from "@/assets/photos/cat-education.jpg";
import sales from "@/assets/photos/cat-sales.jpg";
import cooking from "@/assets/photos/cat-restaurant.jpg";
import autoService from "@/assets/photos/cat-auto-service.jpg";
import agriculture from "@/assets/photos/cat-agriculture.jpg";
import type { CatalogKey } from "./catalog";

/**
 * O'rnatilgan suratlar — faqat egasi bergan (2026-11-05), scripts/photos/build-photos.py bilan bir xil nisbatga kesilgan.
 * Statik import: o'lcham ma'lum (layout siljimaydi), next/image AVIF/WebP va kerakli enida beradi, xira oldindan ko'rinish bilan.
 * "Qurilish" surati bosh sahifa hero'sida — katalogda takrorlanmaydi (admin alohida surat yuklasa, katalogda ham chiqadi).
 */
export const HERO_PHOTO: StaticImageData = heroConstruction;

export const BUILTIN_CATALOG_PHOTOS: Partial<Record<CatalogKey, StaticImageData>> = {
  medicine,
  education,
  sales,
  cooking,
  auto_service: autoService,
  agriculture,
};
