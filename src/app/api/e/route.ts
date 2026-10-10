import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { allowRate } from "@/lib/rate-limit";
import { getSession } from "@/features/auth/session";
import { trackServer } from "@/features/analytics/server";
import { rejectUnsafeRequest } from "@/lib/security/guard";
import { clientIp, ipBucket, subjectHash } from "@/lib/security/request";

/** Mijoz yuborishi mumkin bo'lgan hodisalar (qolganlari faqat serverda yoziladi) */
const CLIENT_EVENTS = new Set(["home_view", "direction_select", "post_start", "post_review", "contact_click"]);
const COOKIE = "ib_aid";
const body = z.object({ name: z.string().max(40), props: z.record(z.string(), z.unknown()).optional() });

/** Voronka hodisalari: profil id yoki tasodifiy anonim id (shaxsiy ma'lumot yozilmaydi) */
export async function POST(request: NextRequest) {
  if (rejectUnsafeRequest(request)) return new NextResponse(null, { status: 403 });
  let parsed;
  try {
    parsed = body.safeParse(JSON.parse((await request.text()).slice(0, 2000)));
  } catch {
    return new NextResponse(null, { status: 400 });
  }
  if (!parsed.success || !CLIENT_EVENTS.has(parsed.data.name)) return new NextResponse(null, { status: 400 });
  // limit kaliti — IP ning HMAC'i (ochiq IP bazaga yozilmaydi)
  if (!(await allowRate(`evt:${subjectHash("ip", ipBucket(clientIp(request.headers)))}`, 600, 3600))) return new NextResponse(null, { status: 429 });
  const existing = request.cookies.get(COOKIE)?.value;
  const anon = existing && /^[A-Za-z0-9_-]{8,64}$/.test(existing) ? existing : randomBytes(16).toString("base64url");
  const session = await getSession();
  await trackServer(parsed.data.name, session?.userId ?? null, parsed.data.props, session ? null : anon);
  const res = new NextResponse(null, { status: 204 });
  if (!existing) res.cookies.set(COOKIE, anon, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax", httpOnly: true, secure: request.nextUrl.protocol === "https:" });
  return res;
}
