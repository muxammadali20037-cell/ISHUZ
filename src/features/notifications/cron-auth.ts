import "server-only";

import { timingSafeEqual } from "node:crypto";
import { getServerEnv } from "@/lib/env";

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && ab.length > 0 && timingSafeEqual(ab, bb);
}

/**
 * Cron / setup endpointlari uchun himoya:
 *   Authorization: Bearer <CRON_SECRET>   (Vercel Cron shu sarlavhani avtomatik yuboradi)
 *   yoki x-cron-secret: <CRON_SECRET>
 */
export function isCronAuthorized(req: Request): boolean {
  const { CRON_SECRET } = getServerEnv();
  if (!CRON_SECRET) return false;
  const auth = req.headers.get("authorization") ?? "";
  const bearer = /^Bearer\s+(.+)$/i.exec(auth)?.[1]?.trim() ?? "";
  if (bearer && safeEqual(bearer, CRON_SECRET)) return true;
  const header = req.headers.get("x-cron-secret")?.trim() ?? "";
  return !!header && safeEqual(header, CRON_SECRET);
}
