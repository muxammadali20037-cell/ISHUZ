"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { getSession } from "@/features/auth/session";
import { allowRate } from "@/lib/rate-limit";
import { clientIp, ipBucket, subjectHash } from "@/lib/security/request";
import { MESSAGE_MAX_CHARS } from "@/features/assistant/types";
import { publishWorkerListing } from "@/features/post/actions";
import { getAlertSubscriptions } from "@/features/alerts/queries";
import { getRegions } from "@/lib/reference";
import { buildPreview, preparePost } from "./quick-post-core";
import type { PostOutcome, PostPreview, PostUnderstood } from "./quick-post-types";
import { isWorkerExtras, type WorkerExtras } from "@/features/post/requirements";

/**
 * Yordamchi orqali ishchi e'loni: matnni tushunish → oyna → "Tasdiqlash" (ko'rinishi) → "Joylash".
 * Joylash — mavjud `publishWorkerListing` orqali (bitta tranzaksiya, majburiy avtomatik tekshiruv, haqiqiy holat).
 * Himoya: bloklangan — yo'q; soatlik limit (kirgan — 120, mehmon IP bo'yicha — 200). Matn serverda saqlanmaydi.
 */

type Out<T> = { ok: true; data: T } | { ok: false; error: string };

async function guard(): Promise<{ ok: true; session: Awaited<ReturnType<typeof getSession>> } | { ok: false; error: "forbidden" | "rate_limited" }> {
  const session = await getSession();
  if (session?.profile.is_blocked) return { ok: false, error: "forbidden" };
  const key = session ? `quick_post:${session.userId}` : `quick_post_ip:${subjectHash("ip", ipBucket(clientIp(await headers())))}`;
  if (!(await allowRate(key, session ? 120 : 200, 3600))) return { ok: false, error: "rate_limited" };
  return { ok: true, session };
}

const prepareSchema = z.object({ text: z.string().trim().max(MESSAGE_MAX_CHARS) });

export async function quickPostPrepare(input: unknown): Promise<Out<PostUnderstood>> {
  const parsed = prepareSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const g = await guard();
  if (!g.ok) return g;
  try {
    return { ok: true, data: await preparePost({ text: parsed.data.text, session: g.session }) };
  } catch (e) {
    console.error(JSON.stringify({ quick_post_prepare_error: e instanceof Error ? e.message.slice(0, 160) : "error" }));
    return { ok: false, error: "search_failed" };
  }
}

const phoneSchema = z.string().regex(/^\+998\d{9}$/);

const answersSchema = z.object({
  professionId: z.uuid(),
  firstName: z.string().trim().min(2).max(60),
  lastName: z.string().trim().max(60),
  regionId: z.uuid(),
  districtId: z.uuid().nullable(),
  experience: z.enum(["none", "lt1", "1_3", "3plus"]),
  // e'londagi raqam: oynada qo'lda yoziladi, majburiy; ikkinchisi ixtiyoriy (bir xil bo'lsa — saqlanmaydi)
  phone: phoneSchema,
  phone2: phoneSchema.nullable(),
  /** tekshirish oynasida yaratilgan AI rasm qoralamasi (joylanganda e'longa) */
  imageDraft: z.uuid().nullable().optional(),
  /** "Izoh" bandlari (mijozda tartibga keltirilgan; serverda yana tozalanadi) */
  notes: z.array(z.string().max(80)).max(8).optional(),
  /** kasbga xos javoblar (guvohnoma toifasi, mashina, transport, asboblar) */
  extras: z.custom<WorkerExtras>((x) => isWorkerExtras(x)).optional(),
});

/** "Tasdiqlash": e'lon qanday ko'rinishi (joylanadigan matnning o'zi) */
export async function quickPostPreview(input: unknown): Promise<Out<PostPreview>> {
  const parsed = answersSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const g = await guard();
  if (!g.ok) return g;
  try {
    const preview = await buildPreview(g.session, parsed.data);
    return preview ? { ok: true, data: preview } : { ok: false, error: "validation" };
  } catch (e) {
    console.error(JSON.stringify({ quick_post_preview_error: e instanceof Error ? e.message.slice(0, 160) : "error" }));
    return { ok: false, error: "generic" };
  }
}

/** "Joylash": kirgan foydalanuvchi uchun; natija — haqiqiy holat (joylandi / tekshiruvda / rad etildi / to'lov kerak) */
export async function quickPostPublish(input: unknown): Promise<Out<PostOutcome>> {
  const parsed = answersSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const session = await getSession();
  if (!session) return { ok: false, error: "not_authenticated" };
  if (session.profile.is_blocked) return { ok: false, error: "blocked" };
  const preview = await buildPreview(session, parsed.data);
  if (!preview) return { ok: false, error: "validation" };
  const a = parsed.data;
  const res = await publishWorkerListing({
    professionNodeId: a.professionId,
    customProfession: null,
    headline: preview.profession.slice(0, 80),
    regionId: a.regionId,
    districtId: a.districtId,
    remoteOk: false,
    firstName: a.firstName,
    lastName: a.lastName,
    about: preview.about.slice(0, 1000),
    experience: a.experience,
    // ega: "oylik maosh kerak emas"
    salary: null,
    schedule: null,
    // ish beruvchilar qo'ng'iroq qilishi uchun (oynada aytiladi). 0081 dan keyin e'londa qo'lda yozilgan raqam(lar)
    // ko'rsatiladi va hisob raqamining ko'rinishi o'zgarmaydi; 0081 qo'llanmagan bazada — avvalgidek hisob raqami.
    showPhone: true,
    listingPhone: a.phone,
    listingPhone2: a.phone2 && a.phone2 !== a.phone ? a.phone2 : null,
    source: "ai",
    imageDraft: a.imageDraft ?? null,
    // 0086 (ega, 2026-11-20: "menga faqat 1 ta e'lon joylay olyapman"): har joylash — yangi e'lon; shu kasb va hududda
    // e'loni bo'lsa — o'sha yangilanadi (takror e'lon bo'lmasin). Birinchi e'lon — asosiy.
    newListing: true,
  });
  if (!res.ok || !res.data) return { ok: false, error: res.ok ? "generic" : res.error };
  const [alerts, regions] = await Promise.all([getAlertSubscriptions(session).catch(() => null), getRegions()]);
  const matches = new URLSearchParams({ mode: "jobs", p: a.professionId });
  const slug = regions.find((r) => r.id === a.regionId)?.slug;
  if (slug) {
    matches.set("region", slug);
    matches.set("district", a.districtId ?? "all");
  }
  const alert = alerts?.subs.worker.status ?? "off";
  return {
    ok: true,
    data: {
      workerId: res.data.workerId,
      info: { state: res.data.state, message: res.data.message, fields: res.data.fields, category: res.data.category, canAppeal: res.data.canAppeal },
      professionId: a.professionId,
      regionId: a.regionId,
      matchesHref: `/search?${matches.toString()}`,
      alert: alert === "active" || alert === "needs_bot" ? alert : "off",
    },
  };
}
