import { NextResponse, after, type NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/features/auth/session";
import { allowRate } from "@/lib/rate-limit";
import { rejectUnsafeRequest } from "@/lib/security/guard";
import { clientIp, ipBucket, subjectHash } from "@/lib/security/request";
import { generateListingImage } from "@/features/listing-image/server";
import { refreshChannelPhoto } from "@/features/telegram-channel/autopost";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** rasm modeli 20–60 s ishlaydi; moderatsiya va saqlash bilan — 2 daqiqagacha */
export const maxDuration = 120;

const body = z.object({ entity: z.enum(["vacancy", "worker"]), id: z.uuid() });

/**
 * POST /api/listing-image { entity, id } — e'lon egasi "Rasm yaratilsinmi? — Ha" bosdi: AI rasm yaratiladi (shu so'rov
 * davomida), tayyor bo'lsa kanaldagi post rasmi ham almashtiriladi (javobdan keyin). Javob: { ok, url } yoki { ok: false, error }.
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

  const { entity, id } = parsed.data;
  const res = await generateListingImage(entity, id, session.userId);
  if (!res.ok) {
    const status = res.error === "forbidden" ? 403 : res.error === "not_found" ? 404 : res.error === "not_configured" ? 503 : 200;
    return NextResponse.json(res, { status, headers: { "Cache-Control": "no-store" } });
  }
  // kanalda allaqachon chiqqan post — yangi rasm bilan (foydalanuvchini kutdirmaydi)
  after(() => refreshChannelPhoto(entity, id, String(Date.now())));
  return NextResponse.json(res, { headers: { "Cache-Control": "no-store" } });
}
