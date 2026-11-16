/**
 * Usta e'loni (ega, 2026-11-17: "kategoriyani tanladi — ikkinchi oyna ochilsin, xizmatini tanlasin"): har kategoriya uchun
 * keng tarqalgan xizmatlar ro'yxati (nomlari — masters.svc.<kategoriya>.<kalit>). Ro'yxatda yo'q xizmat — o'zi yozadi.
 * "other" kategoriyasida ro'yxat yo'q (faqat yoziladi).
 */
export const MASTER_SERVICE_KEYS: Record<string, readonly string[]> = {
  ac: ["install", "clean", "freon", "repair", "dismantle"],
  plumber: ["pipes", "taps", "toilet", "sewer", "heater", "leak"],
  electric: ["wiring", "sockets", "lights", "panel", "fault"],
  appliance: ["washer", "fridge", "stove", "tv", "small"],
  repair: ["flat", "tiles", "drywall", "plaster", "floor", "doors"],
  painter: ["walls", "ceiling", "facade", "wallpaper"],
  builder: ["brick", "concrete", "roof", "foundation", "small"],
  welder: ["gates", "frames", "canopy", "welding"],
  locksmith: ["open", "replace", "install", "keys"],
  moving: ["flat", "office", "city", "intercity", "loaders"],
  furniture: ["assembly", "disassembly", "kitchen", "wardrobe", "repair"],
  other: [],
};

export function masterServiceKeys(categorySlug: string): readonly string[] {
  return MASTER_SERVICE_KEYS[categorySlug] ?? [];
}
