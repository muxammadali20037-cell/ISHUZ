import { jobArchetype } from "@/lib/job-art/archetype";
import type { Archetype } from "@/lib/job-art/person";

/**
 * E'lon rasmi uchun so'rov (ingliz tilida — rasm modellari shunda aniqroq). E'londan avtomatik: kasb (inglizcha nomi bo'lsa —
 * shu, bo'lmasa sarlavha), kasb turi (archetype — kiyim va ish joyi) va e'lon turi. Rasmda HECH QANDAY yozuv bo'lmaydi:
 * matn (kasb, maosh, joy) ustiga o'zimiz shablon bilan yozamiz — AI harflarni (ayniqsa o'zbekcha) xato chizadi.
 * Kompozitsiya: asosiy obyekt o'ng tomonda, chap tomon — matn uchun tinch fon. Bolalar, brend va real shaxslar yo'q.
 */
const SCENES: Record<Archetype, string> = {
  doctor: "a doctor in a white coat in a bright modern clinic",
  nurse: "a nurse in medical scrubs in a clean hospital corridor",
  lab: "a specialist in a lab coat working in a modern laboratory or pharmacy",
  chef: "a cook in a white chef jacket preparing food in a professional restaurant kitchen",
  waiter: "a waiter in a neat uniform serving in a cozy modern restaurant",
  barista: "a barista making coffee behind the counter of a modern coffee shop",
  seller: "a shop assistant arranging goods in a bright modern retail store",
  cashier: "a cashier at the checkout of a clean modern supermarket",
  driver: "a professional driver standing beside a clean modern car on a city street",
  courier: "a delivery courier with a delivery bag next to a scooter on a city street",
  builder: "a construction worker in a hard hat and safety vest at a construction site",
  engineer: "an engineer in a hard hat reviewing plans at an industrial site",
  welder: "a welder in protective gear working in a workshop with sparks",
  electrician: "an electrician in work clothes working on an electrical panel",
  plumber: "a plumber in work clothes fixing pipes in a modern bathroom",
  mechanic: "an auto mechanic in overalls working in a clean car service garage",
  factory: "a worker in a uniform operating equipment in a modern factory",
  miner: "a worker in a hard hat and protective clothing at an industrial site",
  warehouse: "a warehouse worker in a safety vest among shelves with boxes",
  cleaner: "a cleaner in a neat uniform with cleaning equipment in a bright modern office",
  security: "a security guard in a uniform at the entrance of a modern building",
  teacher: "a teacher in a bright modern classroom",
  nanny: "a caring caregiver tidying a bright cozy playroom with toys",
  office: "an office employee working at a laptop in a bright modern office",
  it: "a software specialist working at a computer with two monitors in a modern office",
  callcenter: "a call center operator with a headset at a modern workstation",
  hotel: "a receptionist at the front desk of a modern hotel lobby",
  barber: "a barber with clippers in a stylish modern barbershop",
  beauty: "a beauty specialist with professional tools in a clean modern beauty salon",
  tailor: "a tailor working at a sewing machine in a bright tailoring workshop",
  farmer: "a farm worker in a green field or orchard on a sunny day",
  creative: "a designer working at a creative studio desk",
  artisan: "a craftsman working with tools in a woodworking workshop",
  generic: "a professional worker at a modern workplace",
};

export interface ListingImageInput {
  kind: "vacancy" | "worker";
  /** kasbning nomlari (inglizcha birinchi), sarlavha — kasb turini aniqlash uchun */
  names: (string | null | undefined)[];
  categorySlug?: string | null;
}

function clean(s: string): string {
  // so'rovga faqat oddiy harflar: tirnoq va boshqa belgilar so'rovni buzmasin
  return s.replace(/[^\p{L}\p{N} ,.'-]+/gu, " ").replace(/\s+/g, " ").trim().slice(0, 80);
}

export function buildListingImagePrompt(input: ListingImageInput): string {
  const archetype = jobArchetype({ names: input.names, categorySlug: input.categorySlug ?? null });
  const job = clean(input.names.find((n) => n && n.trim()) ?? "") || "worker";
  const scene = SCENES[archetype];
  const who =
    input.kind === "worker"
      ? "A friendly, confident adult Central Asian person, ready to work, looking at the camera with a warm smile."
      : "The workplace of this job with an adult Central Asian employee busy at work.";
  return [
    `Photorealistic, high-quality commercial photograph for a job advertisement in Uzbekistan. Job: ${job}.`,
    `Scene: ${scene}. ${who}`,
    "Composition: the main subject on the right half of the frame; the left half is a calm, softly blurred background with space for text.",
    "Natural soft daylight, shallow depth of field, clean, modern and trustworthy look, landscape 3:2.",
    "Modest professional clothing. Adults only. Strictly no text, no letters, no numbers, no logos, no brand names, no watermarks, no signs with writing.",
  ].join(" ");
}
