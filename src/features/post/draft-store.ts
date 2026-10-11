/**
 * E'lon qoralamalari (localStorage) — egasi bo'yicha ajratilgan saqlash. React'siz sof funksiyalar (testlanadi).
 *
 * Kalit: ib_draft:v2:<entity>:<new | e:editId>:<owner>; owner = u:<userId> (kirgan) yoki g:<guestId> (mehmon).
 * - Bir qurilmadagi A hisobining qoralamasi B hisobida ko'rinmaydi (kalit va konvert egasi tekshiriladi).
 * - Mehmon qoralamasi faqat "joylash → kirish" bosilgan jarayonda (handoffAt, ≤ 2 soat) kirgan hisobga o'tadi.
 * - Muddati (14 kun) o'tgan, buzilgan JSON yoki noto'g'ri tuzilma — o'chiriladi, forma yangi qoralama bilan ochiladi.
 * - Chiqishda (logout) barcha qoralamalar o'chiriladi va mehmon identifikatori almashtiriladi.
 */

export const DRAFT_PREFIX = "ib_draft:v2:";
export const GUEST_KEY = "ib_guest:v1";
/** Shu qurilmada oxirgi ko'rilgan hisob ("" — mehmon). Boshqa tablar storage hodisasi orqali bilib oladi */
export const LAST_USER_KEY = "ib_last_user:v1";
/** Egasi noma'lum eski kalitlar (v1) — o'qilmaydi, o'chiriladi */
const LEGACY_KEYS = ["ib_post_worker_v1", "ib_post_vacancy_v1"];
const LEGACY_PREFIX = "ib_post_vacancy_edit_";

export const DRAFT_TTL_MS = 14 * 24 * 3600 * 1000;
export const HANDOFF_TTL_MS = 2 * 3600 * 1000;

export type DraftEntity = "worker" | "vacancy";

export interface DraftEnvelope {
  schema: 2;
  owner: string;
  updatedAt: number;
  /** mehmon "joylash" bosib kirishga ketgan vaqt — shu qoralama kirgan hisobga o'tkaziladi */
  handoffAt?: number;
  data: Record<string, unknown>;
}

export type KV = Pick<Storage, "getItem" | "setItem" | "removeItem" | "key" | "length">;

export function ownerOf(userId: string | null, guestId: string): string {
  return userId ? `u:${userId}` : `g:${guestId}`;
}

export function draftKey(entity: DraftEntity, editId: string | null | undefined, owner: string): string {
  return `${DRAFT_PREFIX}${entity}:${editId ? `e:${editId}` : "new"}:${owner}`;
}

function ownerFromKey(key: string): string | null {
  if (!key.startsWith(DRAFT_PREFIX)) return null;
  const m = /:((?:u|g):[^:]+)$/.exec(key);
  return m ? m[1]! : null;
}

function randomId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") crypto.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Shu qurilmadagi mehmon identifikatori (yo'q bo'lsa yaratiladi) */
export function guestId(s: KV): string {
  const cur = s.getItem(GUEST_KEY);
  if (cur && /^[A-Za-z0-9-]{16,64}$/.test(cur)) return cur;
  const id = randomId();
  s.setItem(GUEST_KEY, id);
  return id;
}

export function rotateGuestId(s: KV): string {
  const id = randomId();
  s.setItem(GUEST_KEY, id);
  return id;
}

export function draftKeys(s: KV): string[] {
  const out: string[] = [];
  for (let i = 0; i < s.length; i++) {
    const k = s.key(i);
    if (k && (k.startsWith(DRAFT_PREFIX) || LEGACY_KEYS.includes(k) || k.startsWith(LEGACY_PREFIX))) out.push(k);
  }
  return out;
}

/** Konvertni o'qish: egasi kalitga mos, muddati o'tmagan, tuzilmasi to'g'ri. Aks holda o'chiriladi → null */
export function readEnvelope(s: KV, key: string, now: number): DraftEnvelope | null {
  const raw = s.getItem(key);
  if (raw == null) return null;
  let env: unknown;
  try {
    env = JSON.parse(raw);
  } catch {
    env = null;
  }
  const e = env as Partial<DraftEnvelope> | null;
  const valid =
    !!e &&
    typeof e === "object" &&
    e.schema === 2 &&
    typeof e.owner === "string" &&
    e.owner === ownerFromKey(key) &&
    typeof e.updatedAt === "number" &&
    Number.isFinite(e.updatedAt) &&
    e.updatedAt <= now + 60_000 &&
    now - e.updatedAt <= DRAFT_TTL_MS &&
    (e.handoffAt === undefined || typeof e.handoffAt === "number") &&
    !!e.data &&
    typeof e.data === "object" &&
    !Array.isArray(e.data);
  if (!valid) {
    s.removeItem(key);
    return null;
  }
  return e as DraftEnvelope;
}

/** Yozish natijasi: false — xotira to'la yoki yopiq (foydalanuvchiga "saqlandi" deyilmaydi) */
export function writeEnvelope(s: KV, key: string, env: DraftEnvelope): boolean {
  try {
    s.setItem(key, JSON.stringify(env));
    return true;
  } catch {
    return false;
  }
}

/** Joriy egaga (va joriy mehmonga) tegishli bo'lmagan barcha qoralamalarni o'chirish */
export function purgeForeignDrafts(s: KV, keepOwners: string[]): number {
  let n = 0;
  for (const k of draftKeys(s)) {
    const owner = ownerFromKey(k);
    if (!owner || !keepOwners.includes(owner)) {
      s.removeItem(k);
      n++;
    }
  }
  return n;
}

export function clearAllDrafts(s: KV): number {
  const keys = draftKeys(s);
  for (const k of keys) s.removeItem(k);
  return keys.length;
}

/**
 * Mehmon qoralamasini kirgan hisobga o'tkazish — faqat yangi e'lon va faqat "joylash → kirish" jarayonidan
 * (handoffAt ≤ 2 soat). Boshqa mehmon qoralamalari avtomatik aralashmaydi.
 */
export function claimGuestDraft(s: KV, entity: DraftEntity, guestOwner: string, userOwner: string, now: number): DraftEnvelope | null {
  const gKey = draftKey(entity, null, guestOwner);
  const env = readEnvelope(s, gKey, now);
  if (!env || env.handoffAt === undefined || now - env.handoffAt > HANDOFF_TTL_MS || env.handoffAt > now + 60_000) return null;
  const claimed: DraftEnvelope = { schema: 2, owner: userOwner, updatedAt: now, data: env.data };
  if (!writeEnvelope(s, draftKey(entity, null, userOwner), claimed)) return null;
  s.removeItem(gKey);
  return claimed;
}

/** Maydon tekshiruvchilari: har maydon alohida — bitta buzilgan maydon butun qoralamani yo'qotmaydi */
export type DraftRules<T> = { [K in keyof T]-?: (v: unknown) => boolean };

/**
 * Saqlangan ma'lumotni boshlang'ich qiymat ustiga xavfsiz qo'yish: noma'lum maydonlar tashlanadi,
 * noto'g'ri qiymatli maydon boshlang'ich qiymatda qoladi. `v` (versiya) mos kelmasa — null.
 */
export function sanitizeDraft<T extends { v: number }>(raw: Record<string, unknown>, initial: T, rules: DraftRules<T>): T | null {
  if (raw.v !== initial.v) return null;
  const out = { ...initial } as Record<string, unknown>;
  for (const k of Object.keys(rules) as (keyof T & string)[]) {
    if (k in raw && rules[k](raw[k])) out[k] = raw[k];
  }
  return out as T;
}

// ---- umumiy tekshiruvchilar ----
export const isStr = (max: number) => (v: unknown) => typeof v === "string" && v.length <= max;
export const isBool = (v: unknown) => typeof v === "boolean";
export const isId = (v: unknown) => typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v);
export const isNullableId = (v: unknown) => v === null || isId(v);
export const oneOf = (values: readonly unknown[]) => (v: unknown) => values.includes(v);
export const isStep = (total: number) => (v: unknown) => Number.isInteger(v) && (v as number) >= 1 && (v as number) <= total;

const isTrailItem = (x: unknown) => {
  const t = x as Record<string, unknown> | null;
  return !!t && typeof t === "object" && isId(t.id) && typeof t.name_uz === "string" && typeof t.name_ru === "string" && (t.name_en === null || typeof t.name_en === "string");
};

export const isPickedProfession = (v: unknown) => {
  if (v === null) return true;
  const p = v as Record<string, unknown>;
  return !!p && typeof p === "object" && isId(p.id) && isId(p.categoryId) && Array.isArray(p.trail) && p.trail.length >= 1 && p.trail.length <= 12 && p.trail.every(isTrailItem);
};

export const isCustomProfession = (v: unknown) => {
  if (v === null) return true;
  const c = v as Record<string, unknown>;
  return !!c && typeof c === "object" && typeof c.text === "string" && c.text.trim().length >= 2 && c.text.length <= 120 && isId(c.categoryId);
};

export const isPlace = (v: unknown) => {
  const p = v as Record<string, unknown> | null;
  return !!p && typeof p === "object" && isNullableId(p.regionId) && isNullableId(p.districtId) && isBool(p.districtChosen) && isBool(p.remote);
};
