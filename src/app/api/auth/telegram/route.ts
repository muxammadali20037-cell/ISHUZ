import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getServerEnv } from "@/lib/env";
import { verifyTelegramInitData } from "@/lib/telegram/verify";
import { LOCALES } from "@/lib/i18n/config";
import { hitRate } from "@/lib/rate-limit";
import { readJsonBody, rejectUnsafeRequest } from "@/lib/security/guard";
import { clientIp, ipBucket, subjectHash } from "@/lib/security/request";
import { logSecurityEvent, requestIdOf } from "@/lib/security/events";
import { AccountBlockedError, ensureTelegramProfile, startSessionForProfile } from "@/features/auth/telegram-session";

/**
 * Telegram Mini App orqali kirish.
 * 1) initData imzosi tekshiriladi (server, bot token bilan).
 * 2) telegram_accounts orqali profil topiladi; bo'lmasa yangi auth.users yaratiladi.
 * 3) Admin API bilan magic-link token yaratilib, serverda verifyOtp → sessiya cookie'lari.
 * Faqat o'z saytimizdan JSON (login CSRF yo'q); initData 1 soatdan eski bo'lsa — rad; bloklangan hisob — 403.
 * IP limiti yumshoq (mobil operator NAT ortida ko'p foydalanuvchi bo'ladi).
 */
export async function POST(req: NextRequest) {
  const unsafe = rejectUnsafeRequest(req);
  if (unsafe) return unsafe;
  const { TELEGRAM_BOT_TOKEN } = getServerEnv();
  if (!TELEGRAM_BOT_TOKEN) return NextResponse.json({ error: "telegram_not_configured" }, { status: 503 });

  const body = z.object({ initData: z.string().min(10).max(8192), locale: z.enum(LOCALES).optional() }).safeParse(await readJsonBody(req));
  if (!body.success) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const requestId = requestIdOf(req.headers);
  const ipHash = subjectHash("ip", ipBucket(clientIp(req.headers)));
  const byIp = await hitRate(`tglogin:ip:${ipHash}`, 300, 600);
  if (!byIp.ok) return NextResponse.json({ error: byIp.reason === "unavailable" ? "temporarily_unavailable" : "rate_limited" }, { status: byIp.reason === "unavailable" ? 503 : 429 });

  const tgUser = verifyTelegramInitData(body.data.initData, TELEGRAM_BOT_TOKEN);
  if (!tgUser) {
    const bad = await hitRate(`tglogin:bad:ip:${ipHash}`, Number.MAX_SAFE_INTEGER, 3600);
    if ("count" in bad && bad.count === 20) {
      await logSecurityEvent({ type: "auth.invalid_init_data", severity: "medium", reason: "threshold_20", subjectHash: ipHash, route: "/api/auth/telegram", action: "logged", requestId });
    }
    return NextResponse.json({ error: "invalid_init_data" }, { status: 401 });
  }

  try {
    const admin = createAdminClient();
    const userId = await ensureTelegramProfile(admin, tgUser, body.data.locale);
    await startSessionForProfile(admin, userId, tgUser.id);
    return NextResponse.json({ ok: true, userId });
  } catch (e) {
    if (e instanceof AccountBlockedError) return NextResponse.json({ error: "blocked" }, { status: 403 });
    console.error("[telegram auth]", e instanceof Error ? e.message : "error");
    return NextResponse.json({ error: "auth_failed" }, { status: 500 });
  }
}
