/**
 * Kasbga mos kiyingan odam — chizma (SVG), e'lon rasmlari uchun (ega, 2026-11-16: "har bitta kasbga rasm tayyorla,
 * odamning rasmi bo'lsin, kasbga mos kiyintir"). Tashqi xizmatsiz, bepul, darhol: kiyim (oq xalat, oshpaz qalpog'i, kaska…)
 * kasb turidan, jinsi, teri va soch rangi esa kasb ID'sidan (urug') — har kasb doim bir xil ko'rinadi.
 * Uslub ataylab multfilmga o'xshash: bu haqiqiy ish beruvchi yoki ishchining surati emas, kasbning tasviri.
 * Sof funksiya: SVG matni qaytaradi (next/og va testlar uchun).
 */

export type Archetype =
  | "doctor"
  | "nurse"
  | "lab"
  | "chef"
  | "waiter"
  | "barista"
  | "seller"
  | "cashier"
  | "driver"
  | "courier"
  | "builder"
  | "engineer"
  | "welder"
  | "electrician"
  | "plumber"
  | "mechanic"
  | "factory"
  | "miner"
  | "warehouse"
  | "cleaner"
  | "security"
  | "teacher"
  | "nanny"
  | "office"
  | "it"
  | "callcenter"
  | "hotel"
  | "barber"
  | "beauty"
  | "tailor"
  | "farmer"
  | "creative"
  | "artisan"
  | "generic";

type Hat = "toque" | "hardhat" | "minerhat" | "cap" | "peaked" | "straw" | "welder" | "nurse" | "beanie" | "headset";
type Collar = "shirt" | "polo" | "v" | "round" | "hoodie" | "turtle" | "chef" | "zip";
type Neck = "stethoscope" | "headphones" | "tape" | "kerchief";

interface Outfit {
  /** asosiy kiyim rangi */
  top: string;
  collar: Collar;
  /** xalat/pidjak ostidagi ko'ylak (V ochiq joy) */
  inner?: string;
  lapels?: boolean;
  tie?: string;
  bow?: string;
  /** nimcha (ofitsiant) yoki yorqin jilet (quruvchi) */
  vest?: { color: string; reflective?: boolean };
  apron?: string;
  /** kombinezon bog'ichlari (santexnik) */
  bib?: string;
  buttons?: "double" | "single";
  badge?: boolean;
  pocket?: boolean;
  epaulettes?: boolean;
  plaid?: string;
  neck?: Neck;
  hat?: Hat;
  hatColor?: string;
  glasses?: boolean;
  /** ayollar uchun ro'mol (shapka bo'lmasa) ko'proq mos */
  scarfBias?: boolean;
}

const OUTFITS: Record<Archetype, Outfit> = {
  doctor: { top: "#F8FAFC", collar: "shirt", inner: "#93C5FD", lapels: true, tie: "#1E3A8A", neck: "stethoscope", pocket: true },
  nurse: { top: "#5EC4C0", collar: "v", hat: "nurse", badge: true },
  lab: { top: "#F8FAFC", collar: "shirt", inner: "#C7D2FE", lapels: true, glasses: true, pocket: true },
  chef: { top: "#FFFFFF", collar: "chef", buttons: "double", neck: "kerchief", hat: "toque" },
  waiter: { top: "#FFFFFF", collar: "shirt", vest: { color: "#1F2937" }, bow: "#7F1D1D" },
  barista: { top: "#E7E5E4", collar: "round", apron: "#7C4A2D", hat: "cap", hatColor: "#57534E" },
  seller: { top: "#16A34A", collar: "polo", apron: "#14532D", badge: true },
  cashier: { top: "#DC2626", collar: "polo", badge: true },
  driver: { top: "#BFDBFE", collar: "shirt", hat: "cap", hatColor: "#1E3A8A", pocket: true },
  courier: { top: "#F97316", collar: "zip", hat: "cap", hatColor: "#1F2937" },
  builder: { top: "#334155", collar: "round", vest: { color: "#F97316", reflective: true }, hat: "hardhat", hatColor: "#FACC15" },
  engineer: { top: "#BFDBFE", collar: "shirt", tie: "#334155", hat: "hardhat", hatColor: "#F8FAFC", pocket: true },
  welder: { top: "#475569", collar: "zip", hat: "welder", pocket: true },
  electrician: { top: "#2563EB", collar: "shirt", hat: "hardhat", hatColor: "#F8FAFC", pocket: true },
  plumber: { top: "#CBD5E1", collar: "round", bib: "#1D4ED8", hat: "beanie", hatColor: "#1E3A8A" },
  mechanic: { top: "#475569", collar: "zip", badge: true },
  factory: { top: "#1E40AF", collar: "zip", hat: "cap", hatColor: "#1E3A8A", glasses: true },
  miner: { top: "#374151", collar: "zip", vest: { color: "#EA580C", reflective: true }, hat: "minerhat", hatColor: "#FACC15" },
  warehouse: { top: "#64748B", collar: "round", vest: { color: "#EAB308", reflective: true }, hat: "cap", hatColor: "#334155" },
  cleaner: { top: "#A78BFA", collar: "v", badge: true, scarfBias: true },
  security: { top: "#1E293B", collar: "shirt", tie: "#0F172A", epaulettes: true, hat: "peaked", hatColor: "#0F172A", badge: true },
  teacher: { top: "#B45309", collar: "shirt", inner: "#FEF3C7", lapels: true, glasses: true },
  nanny: { top: "#F9A8D4", collar: "round", pocket: true, scarfBias: true },
  office: { top: "#1E3A8A", collar: "shirt", inner: "#F8FAFC", lapels: true, tie: "#B91C1C" },
  it: { top: "#334155", collar: "hoodie", neck: "headphones" },
  callcenter: { top: "#7C3AED", collar: "polo", hat: "headset" },
  hotel: { top: "#7F1D1D", collar: "shirt", inner: "#F8FAFC", lapels: true, bow: "#111827", badge: true },
  barber: { top: "#F1F5F9", collar: "shirt", apron: "#111827" },
  beauty: { top: "#F472B6", collar: "v", badge: true },
  tailor: { top: "#F1F5F9", collar: "shirt", neck: "tape" },
  farmer: { top: "#15803D", collar: "shirt", plaid: "#14532D", hat: "straw" },
  creative: { top: "#0EA5E9", collar: "turtle", glasses: true },
  artisan: { top: "#E2E8F0", collar: "round", apron: "#92400E" },
  generic: { top: "#2457F5", collar: "polo", badge: true },
};

export const ARCHETYPES = Object.keys(OUTFITS) as Archetype[];

const SKIN: [string, string][] = [
  ["#F3CBA5", "#E2B089"],
  ["#E2AD84", "#CB936A"],
  ["#C98F68", "#AE7651"],
];
const HAIR = ["#1E1A18", "#2E211A", "#4A3326"];

/** Barqaror kichik xesh (FNV-1a) — urug'dan tanlov */
export function seedOf(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export interface PersonLook {
  female: boolean;
  skin: number;
  hair: number;
  /** soch turmagi: erkak — 0 qisqa, 1 yon tomonga; ayol — 0 tugun, 1 uzun, 2 ro'mol */
  style: number;
}

export function lookFor(archetype: Archetype, seed: string): PersonLook {
  const h = seedOf(`${archetype}:${seed}`);
  const female = h % 2 === 0;
  const o = OUTFITS[archetype];
  const scarfChance = o.scarfBias ? 2 : 4; // har 2 (yoki 4) ayoldan biri ro'mol bilan
  const style = female ? ((h >>> 3) % scarfChance === 0 && !o.hat ? 2 : (h >>> 5) % 2) : (h >>> 5) % 2;
  return { female, skin: (h >>> 8) % SKIN.length, hair: (h >>> 11) % HAIR.length, style };
}

const TORSO = "M28 460C30 372 80 318 150 302C165 298 175 296 200 296C225 296 235 298 250 302C320 318 370 372 372 460Z";

function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(c + amt * 255)));
  const r = f((n >> 16) & 255);
  const g = f((n >> 8) & 255);
  const b = f(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

/** Odam (bel qismigacha) — viewBox 0 0 400 460 */
export function personSvg(archetype: Archetype, look: PersonLook): string {
  const o = OUTFITS[archetype];
  const [skin, skinShade] = SKIN[look.skin] ?? SKIN[0]!;
  const hair = HAIR[look.hair] ?? HAIR[0]!;
  const p: string[] = [];
  const dark = shade(o.top, -0.12);
  const scarf = look.female && look.style === 2 && !o.hat;
  const longHair = look.female && look.style === 1;
  const scarfColor = ["#0F766E", "#9D174D", "#1D4ED8"][look.hair] ?? "#0F766E";

  // --- orqa qatlam: uzun soch, ro'mol orqasi, kapyushon
  if (longHair) p.push(`<path d="M126 170C122 112 158 84 200 84C242 84 278 112 274 170L284 322C262 336 240 328 232 304L168 304C160 328 138 336 116 322Z" fill="${hair}"/>`);
  if (scarf) p.push(`<path d="M118 178C112 104 156 76 200 76C244 76 288 104 282 178C286 240 270 290 250 312L150 312C130 290 114 240 118 178Z" fill="${scarfColor}"/>`);
  if (o.collar === "hoodie") p.push(`<path d="M138 304C140 262 260 262 262 304C250 330 150 330 138 304Z" fill="${dark}"/>`);

  // --- bo'yin
  p.push(`<path d="M172 222L172 300C185 314 215 314 228 300L228 222Z" fill="${skin}"/>`);
  p.push(`<path d="M172 236C185 252 215 252 228 236L228 264C215 276 185 276 172 264Z" fill="${skinShade}"/>`);

  // --- tana (kiyim)
  p.push(`<path d="${TORSO}" fill="${o.top}"/>`);
  if (o.plaid) {
    p.push(`<clipPath id="t"><path d="${TORSO}"/></clipPath><g clip-path="url(#t)" opacity="0.35">`);
    for (let x = 40; x < 380; x += 34) p.push(`<rect x="${x}" y="290" width="12" height="180" fill="${o.plaid}"/>`);
    for (let y = 312; y < 470; y += 34) p.push(`<rect x="20" y="${y}" width="370" height="12" fill="${o.plaid}"/>`);
    p.push(`</g>`);
  }
  // qo'llar chizig'i (yengga o'xshatish)
  p.push(`<path d="M92 460C94 404 100 362 114 336" stroke="${dark}" stroke-width="4" fill="none" stroke-linecap="round" opacity="0.6"/>`);
  p.push(`<path d="M308 460C306 404 300 362 286 336" stroke="${dark}" stroke-width="4" fill="none" stroke-linecap="round" opacity="0.6"/>`);

  // ochiq yoqa / ichki ko'ylak
  if (o.lapels) {
    p.push(`<path d="M164 300L200 402L236 300Z" fill="${o.inner ?? "#F8FAFC"}"/>`);
    p.push(`<path d="M164 300L200 400L178 372L144 314Z" fill="${dark}"/>`);
    p.push(`<path d="M236 300L200 400L222 372L256 314Z" fill="${dark}"/>`);
  }
  if (o.collar === "v") p.push(`<path d="M172 298L200 346L228 298Z" fill="${skin}"/><path d="M168 298L200 352L232 298" stroke="${dark}" stroke-width="5" fill="none" stroke-linejoin="round"/>`);
  if (o.collar === "round") p.push(`<path d="M166 299C178 318 222 318 234 299" stroke="${dark}" stroke-width="7" fill="none" stroke-linecap="round"/>`);
  if (o.collar === "turtle") p.push(`<rect x="166" y="262" width="68" height="44" rx="14" fill="${dark}"/>`);
  if (o.collar === "zip") p.push(`<path d="M200 300L200 460" stroke="${dark}" stroke-width="5"/><path d="M164 296L184 326L200 302L216 326L236 296" fill="${dark}"/>`);
  if (o.collar === "hoodie") p.push(`<path d="M186 314L184 380M214 314L216 380" stroke="#E5E7EB" stroke-width="5" stroke-linecap="round"/><circle cx="184" cy="384" r="5" fill="#E5E7EB"/><circle cx="216" cy="384" r="5" fill="#E5E7EB"/>`);
  if (o.collar === "polo") {
    const c = shade(o.top, -0.18);
    p.push(`<path d="M168 296L152 326L196 314Z" fill="${c}"/><path d="M232 296L248 326L204 314Z" fill="${c}"/>`);
    p.push(`<path d="M200 312L200 360" stroke="${c}" stroke-width="4"/><circle cx="200" cy="330" r="4" fill="${c}"/><circle cx="200" cy="350" r="4" fill="${c}"/>`);
  }
  if (o.collar === "chef") {
    p.push(`<path d="M232 300C212 340 206 384 210 460" stroke="#E2E8F0" stroke-width="4" fill="none"/>`);
    p.push(`<rect x="164" y="286" width="72" height="22" rx="10" fill="#F1F5F9"/>`);
  }
  if (o.collar === "shirt") {
    const c = o.lapels ? (o.inner ?? "#F8FAFC") : o.top;
    const s = shade(c, -0.15);
    p.push(`<path d="M168 292L200 322L182 336L158 304Z" fill="${c}" stroke="${s}" stroke-width="3" stroke-linejoin="round"/>`);
    p.push(`<path d="M232 292L200 322L218 336L242 304Z" fill="${c}" stroke="${s}" stroke-width="3" stroke-linejoin="round"/>`);
  }

  if (o.vest) {
    const v = o.vest.color;
    p.push(`<path d="M90 460L96 338C120 318 140 308 164 300L196 388L196 460Z" fill="${v}"/>`);
    p.push(`<path d="M310 460L304 338C280 318 260 308 236 300L204 388L204 460Z" fill="${v}"/>`);
    if (o.vest.reflective) {
      for (const y of [392, 428]) p.push(`<rect x="96" y="${y}" width="100" height="13" fill="#E5E7EB" opacity="0.92"/><rect x="204" y="${y}" width="100" height="13" fill="#E5E7EB" opacity="0.92"/>`);
    } else {
      p.push(`<circle cx="190" cy="408" r="5" fill="#9CA3AF"/><circle cx="190" cy="436" r="5" fill="#9CA3AF"/>`);
    }
  }
  if (o.apron) {
    p.push(`<path d="M150 344L172 300M250 344L228 300" stroke="${o.apron}" stroke-width="8" stroke-linecap="round"/>`);
    p.push(`<path d="M142 342L258 342L268 460L132 460Z" fill="${o.apron}"/>`);
    p.push(`<rect x="176" y="392" width="48" height="30" rx="5" fill="none" stroke="${shade(o.apron, 0.12)}" stroke-width="4"/>`);
  }
  if (o.bib) {
    p.push(`<path d="M158 370L132 318M242 370L268 318" stroke="${o.bib}" stroke-width="16" stroke-linecap="round"/>`);
    p.push(`<path d="M150 366L250 366L256 460L144 460Z" fill="${o.bib}"/>`);
    p.push(`<circle cx="160" cy="378" r="6" fill="#FACC15"/><circle cx="240" cy="378" r="6" fill="#FACC15"/>`);
    p.push(`<rect x="180" y="396" width="40" height="28" rx="4" fill="none" stroke="${shade(o.bib, 0.18)}" stroke-width="4"/>`);
  }
  if (archetype === "courier") p.push(`<path d="M112 336L136 460M288 336L264 460" stroke="#1F2937" stroke-width="18" stroke-linecap="round"/><rect x="118" y="400" width="26" height="12" rx="3" fill="#94A3B8"/><rect x="256" y="400" width="26" height="12" rx="3" fill="#94A3B8"/>`);
  if (o.buttons === "double") for (const y of [336, 372, 408, 444]) p.push(`<circle cx="176" cy="${y}" r="6" fill="#CBD5E1"/><circle cx="226" cy="${y}" r="6" fill="#CBD5E1"/>`);
  if (o.pocket) p.push(`<rect x="232" y="352" width="44" height="34" rx="5" fill="none" stroke="${o.lapels ? "#CBD5E1" : dark}" stroke-width="4"/><path d="M244 352L246 342M256 352L258 340" stroke="#2563EB" stroke-width="4" stroke-linecap="round"/>`);
  if (o.badge) p.push(`<rect x="${o.pocket ? 132 : 236}" y="350" width="52" height="22" rx="5" fill="#FFFFFF"/><rect x="${o.pocket ? 140 : 244}" y="358" width="34" height="6" rx="3" fill="#94A3B8"/>`);
  if (o.epaulettes) p.push(`<path d="M84 334L134 316L138 328L88 346Z" fill="#0F172A"/><path d="M316 334L266 316L262 328L312 346Z" fill="#0F172A"/><circle cx="128" cy="322" r="4" fill="#EAB308"/><circle cx="272" cy="322" r="4" fill="#EAB308"/>`);
  // ayollarda galstuk o'rniga ochiq yoqa (ofis, muhandis)
  if (o.tie && !(look.female && (archetype === "office" || archetype === "engineer"))) p.push(`<path d="M190 306L210 306L207 324L193 324Z" fill="${o.tie}"/><path d="M193 324L207 324L212 336L206 394L200 406L194 394L188 336Z" fill="${o.tie}"/>`);
  if (o.bow) p.push(`<path d="M200 312L176 300L176 326Z" fill="${o.bow}"/><path d="M200 312L224 300L224 326Z" fill="${o.bow}"/><rect x="193" y="305" width="14" height="14" rx="4" fill="${shade(o.bow, -0.1)}"/>`);
  if (o.neck === "kerchief") p.push(`<path d="M172 294L228 294L200 332Z" fill="#DC2626"/>`);
  if (o.neck === "tape") {
    p.push(`<path d="M164 296C156 350 160 404 168 452" stroke="#FACC15" stroke-width="13" fill="none" stroke-linecap="round"/><path d="M236 296C246 340 244 378 236 412" stroke="#FACC15" stroke-width="13" fill="none" stroke-linecap="round"/>`);
    p.push(`<path d="M164 296C156 350 160 404 168 452" stroke="#713F12" stroke-width="4" stroke-dasharray="2 9" fill="none"/><path d="M236 296C246 340 244 378 236 412" stroke="#713F12" stroke-width="4" stroke-dasharray="2 9" fill="none"/>`);
  }
  if (o.neck === "stethoscope") {
    p.push(`<path d="M170 298C150 336 150 380 168 404" stroke="#334155" stroke-width="7" fill="none" stroke-linecap="round"/>`);
    p.push(`<path d="M230 298C250 330 254 356 244 380" stroke="#334155" stroke-width="7" fill="none" stroke-linecap="round"/>`);
    p.push(`<circle cx="170" cy="414" r="15" fill="#94A3B8" stroke="#334155" stroke-width="5"/><circle cx="170" cy="414" r="6" fill="#E2E8F0"/>`);
    p.push(`<path d="M244 380L234 394M244 380L256 392" stroke="#334155" stroke-width="5" stroke-linecap="round"/>`);
  }
  if (o.neck === "headphones") {
    p.push(`<path d="M150 300C162 334 238 334 250 300" stroke="#111827" stroke-width="9" fill="none" stroke-linecap="round"/>`);
    p.push(`<ellipse cx="148" cy="300" rx="17" ry="21" fill="#111827"/><ellipse cx="252" cy="300" rx="17" ry="21" fill="#111827"/><ellipse cx="148" cy="300" rx="8" ry="11" fill="#475569"/><ellipse cx="252" cy="300" rx="8" ry="11" fill="#475569"/>`);
  }

  // --- bosh
  p.push(`<ellipse cx="134" cy="182" rx="11" ry="17" fill="${skin}"/><ellipse cx="266" cy="182" rx="11" ry="17" fill="${skin}"/>`);
  p.push(`<ellipse cx="135" cy="183" rx="5" ry="9" fill="${skinShade}"/><ellipse cx="265" cy="183" rx="5" ry="9" fill="${skinShade}"/>`);
  p.push(`<ellipse cx="200" cy="172" rx="66" ry="78" fill="${skin}"/>`);

  // yuz
  p.push(`<path d="M162 160Q176 152 190 158" stroke="${hair}" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M210 158Q224 152 238 160" stroke="${hair}" stroke-width="5" fill="none" stroke-linecap="round"/>`);
  p.push(`<ellipse cx="176" cy="182" rx="6.5" ry="8" fill="#26211E"/><ellipse cx="224" cy="182" rx="6.5" ry="8" fill="#26211E"/><circle cx="178.5" cy="179" r="2.2" fill="#FFFFFF"/><circle cx="226.5" cy="179" r="2.2" fill="#FFFFFF"/>`);
  if (look.female) p.push(`<path d="M168 175L164 171M232 175L236 171" stroke="#26211E" stroke-width="3" stroke-linecap="round"/>`);
  p.push(`<path d="M200 190Q195 206 203 210" stroke="${skinShade}" stroke-width="4.5" fill="none" stroke-linecap="round"/>`);
  p.push(`<circle cx="164" cy="210" r="11" fill="#F28B82" opacity="0.28"/><circle cx="236" cy="210" r="11" fill="#F28B82" opacity="0.28"/>`);
  p.push(`<path d="M183 223Q200 240 217 223" stroke="#9A4A3C" stroke-width="5" fill="none" stroke-linecap="round"/>`);
  if (o.glasses) p.push(`<rect x="156" y="166" width="40" height="30" rx="11" fill="#FFFFFF" fill-opacity="0.18" stroke="#1F2937" stroke-width="4"/><rect x="204" y="166" width="40" height="30" rx="11" fill="#FFFFFF" fill-opacity="0.18" stroke="#1F2937" stroke-width="4"/><path d="M196 178Q200 174 204 178" stroke="#1F2937" stroke-width="4" fill="none"/>`);

  // --- old soch / ro'mol (shapkadan oldin)
  if (scarf) {
    p.push(`<path d="M126 196C120 118 162 90 200 90C238 90 280 118 274 196C276 236 262 266 246 284L234 266C252 246 262 222 262 186C262 140 236 112 200 112C164 112 138 140 138 186C138 222 148 246 166 266L154 284C138 266 124 236 126 196Z" fill="${scarfColor}"/>`);
    p.push(`<path d="M150 116C176 102 224 102 250 116" stroke="${shade(scarfColor, 0.15)}" stroke-width="5" fill="none" stroke-linecap="round" opacity="0.7"/>`);
  } else if (!o.hat || o.hat === "nurse" || o.hat === "headset") {
    if (look.female) {
      if (look.style === 0) p.push(`<circle cx="200" cy="90" r="26" fill="${hair}"/>`);
      p.push(`<path d="M132 178C126 118 160 92 200 92C240 92 274 118 268 178C262 150 248 128 226 120C206 136 168 142 146 132C138 146 134 160 132 178Z" fill="${hair}"/>`);
    } else if (look.style === 0) {
      p.push(`<path d="M134 172C128 118 160 90 200 90C242 90 274 116 266 172C262 148 252 130 238 122C214 134 178 136 152 126C142 138 137 152 134 172Z" fill="${hair}"/>`);
    } else {
      p.push(`<path d="M134 172C128 112 162 88 204 88C246 90 274 120 266 172C258 140 240 120 214 116C190 124 162 140 140 140C137 150 135 160 134 172Z" fill="${hair}"/>`);
    }
  } else if (look.female && !longHair) {
    // shapka ostidan ko'rinadigan soch (yon tomonlar)
    p.push(`<path d="M134 176C132 160 134 150 140 142L150 150C144 158 140 166 138 178ZM266 176C268 160 266 150 260 142L250 150C256 158 260 166 262 178Z" fill="${hair}"/>`);
  } else if (!look.female) {
    p.push(`<path d="M136 170C134 156 136 148 142 140L152 148C146 156 142 162 140 172ZM264 170C266 156 264 148 258 140L248 148C254 156 258 162 260 172Z" fill="${hair}"/>`);
  }

  // --- bosh kiyim
  const hc = o.hatColor ?? "#1F2937";
  switch (o.hat) {
    case "toque":
      p.push(`<path d="M142 112C118 104 110 66 138 54C142 26 178 20 194 38C206 16 244 22 248 48C278 50 288 90 260 112Z" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="4"/>`);
      p.push(`<rect x="138" y="104" width="124" height="34" rx="8" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="4"/>`);
      break;
    case "hardhat":
    case "minerhat":
      p.push(`<path d="M128 136C128 84 160 60 200 60C240 60 272 84 272 136Z" fill="${hc}"/>`);
      p.push(`<rect x="193" y="61" width="14" height="75" rx="5" fill="${shade(hc, -0.1)}"/>`);
      p.push(`<rect x="112" y="130" width="176" height="16" rx="8" fill="${shade(hc, -0.14)}"/>`);
      if (o.hat === "minerhat") p.push(`<circle cx="200" cy="104" r="15" fill="#FEF9C3" stroke="#334155" stroke-width="5"/>`);
      break;
    case "cap":
      p.push(`<path d="M132 136C132 90 164 68 200 68C236 68 268 90 268 136Z" fill="${hc}"/>`);
      p.push(`<path d="M134 134Q200 166 266 134Q200 144 134 134Z" fill="${shade(hc, -0.12)}"/>`);
      p.push(`<circle cx="200" cy="70" r="6" fill="${shade(hc, -0.12)}"/>`);
      break;
    case "peaked":
      p.push(`<path d="M124 114C128 84 168 74 200 74C232 74 272 84 276 114L262 136L138 136Z" fill="${hc}"/>`);
      p.push(`<rect x="136" y="122" width="128" height="16" rx="4" fill="#020617"/>`);
      p.push(`<path d="M140 136Q200 162 260 136Z" fill="#020617"/>`);
      p.push(`<circle cx="200" cy="104" r="10" fill="#EAB308"/>`);
      break;
    case "straw":
      p.push(`<ellipse cx="200" cy="122" rx="118" ry="24" fill="#E8C77A" stroke="#C9A456" stroke-width="4"/>`);
      p.push(`<path d="M148 122C148 82 170 68 200 68C230 68 252 82 252 122Z" fill="#EED38E"/>`);
      p.push(`<rect x="149" y="104" width="102" height="14" fill="#8B5E34"/>`);
      break;
    case "welder":
      p.push(`<path d="M134 142C132 96 162 70 200 70C238 70 268 96 266 142L252 128L148 128Z" fill="#4B5563"/>`);
      p.push(`<rect x="172" y="88" width="56" height="22" rx="5" fill="#111827"/><rect x="178" y="92" width="18" height="6" rx="3" fill="#475569"/>`);
      p.push(`<rect x="134" y="128" width="132" height="12" rx="5" fill="#1F2937"/>`);
      break;
    case "nurse":
      p.push(`<path d="M158 104L242 104L234 78L166 78Z" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="4" stroke-linejoin="round"/>`);
      break;
    case "beanie":
      p.push(`<path d="M134 138C132 86 164 68 200 68C236 68 268 86 266 138Z" fill="${hc}"/>`);
      p.push(`<rect x="130" y="122" width="140" height="22" rx="10" fill="${shade(hc, -0.12)}"/>`);
      break;
    case "headset":
      p.push(`<path d="M134 176C128 106 168 84 200 84C232 84 272 106 266 176" stroke="#1F2937" stroke-width="9" fill="none" stroke-linecap="round"/>`);
      p.push(`<rect x="118" y="160" width="24" height="40" rx="10" fill="#1F2937"/><rect x="258" y="160" width="24" height="40" rx="10" fill="#1F2937"/>`);
      p.push(`<path d="M270 198C266 226 244 238 220 236" stroke="#1F2937" stroke-width="6" fill="none" stroke-linecap="round"/><circle cx="216" cy="236" r="8" fill="#1F2937"/>`);
      break;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 460" width="400" height="460">${p.join("")}</svg>`;
}

/** next/og (<img>) uchun data URI */
export function personDataUri(archetype: Archetype, seed: string): string {
  return `data:image/svg+xml;base64,${Buffer.from(personSvg(archetype, lookFor(archetype, seed))).toString("base64")}`;
}
