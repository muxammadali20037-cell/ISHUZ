import { NextResponse, after, type NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/features/auth/session";
import { allowRate } from "@/lib/rate-limit";
import { rejectUnsafeRequest } from "@/lib/security/guard";
import { clientIp, ipBucket, subjectHash } from "@/lib/security/request";
import { generateDraftImage, generateListingImage } from "@/features/listing-image/server";
import { refreshChannelPhoto } from "@/features/telegram-channel/autopost";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** rasm modeli 20–60 s ishlaydi; moderatsiya va saqlash bilan — 2 daqiqagacha */
export const maxDuration = 120;

const entity = z.enum(["vacancy", "worker"]);
/** joylangan e'lon uchun (tahrir) yoki joylashdan oldingi qoralama uchun (tekshirish sahifasida) */
const body = z.union([
  z.object({ entity, id: z.uuid() }),
  z.object({ entity, draft: z.uuid(), professionId: z.uuid().nullable().optional(), title: z.string().trim().max(120).nullable().optional() }),
]);

/**
 * POST /api/listing-image — AI e'lon rasmi (shu so'rov davomida yaratiladi). Javob: { ok, url } yoki { ok: false, error }.
 *  · { entity, draft, professionId?, title? } — e'lon JOYLANISHIDAN OLDIN, tekshirish sahifasida (ega, 2026-11-22: "ma'qul
 *    kelsa joylash kerak"); joylanganda e'longa biriktiriladi (attachDraftImage).
 *  · { entity, id } — joylangan e'lon uchun; kanaldagi post rasmi ham almashtiriladi (javobdan keyin).
 * Faqat kirgan egasi; IP bo'yicha soatiga 20 ta; xarajat chegaralari — bazada (claim_listing_image).
 */
export async function POST(req: NextRequest) {
  const unsafe = rejectUnsafeRequest(req);
  if (unsafe) return unsafe;
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });
  if (session.profile.is_blocked) return NextResponse.json({ ok: false, error: "blocked" }, { status: 403 });
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 });

  const ipHash = subjectHash("ip", ipBucket(clientIp(req.headers)));
  if (!(await allowRate(`listing-image:ip:${ipHash}`, 20, 3600))) return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });

  const input = parsed.data;
  const res =
    "draft" in input
      ? await generateDraftImage(input.entity, input.draft, session.userId, { professionId: input.professionId ?? null, title: input.title ?? null })
      : await generateListingImage(input.entity, input.id, session.userId);
  if (!res.ok) {
    const status = res.error === "forbidden" ? 403 : res.error === "not_found" ? 404 : res.error === "not_configured" ? 503 : 200;
    return NextResponse.json(res, { status, headers: { "Cache-Control": "no-store" } });
  }
  // kanalda allaqachon chiqqan post — yangi rasm bilan (foydalanuvchini kutdirmaydi); qoralamada post hali yo'q
  if ("id" in input) after(() => refreshChannelPhoto(input.entity, input.id, String(Date.now())));
  return NextResponse.json(res, { headers: { "Cache-Control": "no-store" } });
}
