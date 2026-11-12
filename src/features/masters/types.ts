import type { Database, Enums, Tables } from "@/types/database.types";

/**
 * "Universal ustalar" — xizmat ko'rsatuvchi ustalar bozori (0076). Doimiy ish vakansiyalaridan alohida jadvallar.
 * Ommaviy ro'yxat va bitta e'lon — SECURITY DEFINER funksiyalar natijasi (telefon faqat egasi roziligi bilan, faqat e'lon sahifasida).
 */
export type MasterCategory = Tables<"master_categories">;
export type MasterListingStatus = Enums<"master_listing_status">;
export type MasterRequestStatus = Enums<"master_request_status">;

/** Ro'yxat qatori (telefonsiz) */
export type MasterPublic =
  Database["public"]["Functions"]["master_listings_public"]["Returns"][number];
/** E'lon sahifasi (telefon — faqat phone_public bo'lsa) */
export type MasterDetail =
  Database["public"]["Functions"]["master_listing_public"]["Returns"][number];
/** Egasining e'loni (barcha maydonlar, holati, hisoblagichlari) */
export type MyMasterListing = Tables<"master_listings">;
export type MasterRequest = Tables<"master_requests">;
export type MasterReview = Tables<"master_reviews">;

export const MASTER_STATUSES: MasterListingStatus[] = [
  "draft",
  "pending_review",
  "active",
  "hidden",
  "rejected",
];
export const MASTER_PAGE_SIZE = 24;
export const MASTER_PHOTOS_MAX = 4;
export const MASTER_SERVICES_MAX = 12;
