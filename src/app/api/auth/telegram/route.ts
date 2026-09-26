import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getServerEnv } from "@/lib/env";
import { verifyTelegramInitData, type TelegramInitUser } from "@/lib/telegram/verify";

/**
 * Telegram Mini App orqali kirish.
 * 1) initData imzosi tekshiriladi (server, bot token bilan).
 * 2) telegram_accounts orqali profil topiladi; bo'lmasa yangi auth.users yaratiladi.
 *    (Telefon orqali kirgan foydalanuvchi keyin Telegramni bog'lasa — o'sha profil ishlatiladi.)
 * 3) Admin API bilan magic-link token yaratilib, serverda verifyOtp → sessiya cookie'lari.
 */
export async function POST(req: NextRequest) {
  const { TELEGRAM_BOT_TOKEN } = getServerEnv();
  if (!TELEGRAM_BOT_TOKEN) return NextResponse.json({ error: "telegram_not_configured" }, { status: 503 });

  const body = z.object({ initData: z.string().min(10), locale: z.enum(["uz", "ru"]).optional() }).safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const tgUser = verifyTelegramInitData(body.data.initData, TELEGRAM_BOT_TOKEN);
  if (!tgUser) return NextResponse.json({ error: "invalid_init_data" }, { status: 401 });

  const admin = createAdminClient();
  const email = telegramEmail(tgUser.id);

  // Mavjud bog'lanish
  const { data: linked } = await admin.from("telegram_accounts").select("profile_id").eq("telegram_user_id", tgUser.id).maybeSingle();
  let userId = linked?.profile_id ?? null;

  if (!userId) {
    // Ehtimol oldin yaratilgan, lekin telegram_accounts yozuvi yo'q (masalan, o'chirilgan)
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: {
        first_name: tgUser.first_name,
        last_name: tgUser.last_name ?? "",
        avatar_url: tgUser.photo_url ?? null,
        locale: body.data.locale ?? (tgUser.language_code === "ru" ? "ru" : "uz"),
        telegram_id: tgUser.id,
      },
    });
    if (createErr) {
      if (/already/i.test(createErr.message)) {
        const existing = await findUserByEmail(admin, email);
        if (!existing) return NextResponse.json({ error: "auth_failed" }, { status: 500 });
        userId = existing;
      } else {
        console.error("[telegram auth] createUser", createErr.message);
        return NextResponse.json({ error: "auth_failed" }, { status: 500 });
      }
    } else {
      userId = created.user.id;
    }
  }

  await upsertTelegramAccount(admin, userId, tgUser);

  // Sessiya: magic link token_hash → verifyOtp (cookie'lar o'rnatiladi)
  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (linkErr || !link.properties?.hashed_token) {
    console.error("[telegram auth] generateLink", linkErr?.message);
    return NextResponse.json({ error: "auth_failed" }, { status: 500 });
  }
  const supabase = await createClient();
  const { error: verifyErr } = await supabase.auth.verifyOtp({ token_hash: link.properties.hashed_token, type: "magiclink" });
  if (verifyErr) {
    console.error("[telegram auth] verifyOtp", verifyErr.message);
    return NextResponse.json({ error: "auth_failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, userId });
}

function telegramEmail(tgId: number) {
  return `tg_${tgId}@telegram.ishuz.local`;
}

async function findUserByEmail(admin: ReturnType<typeof createAdminClient>, email: string): Promise<string | null> {
  // Admin API da to'g'ridan-to'g'ri email bo'yicha qidiruv yo'q; sahifalab topamiz (kam uchraydigan holat)
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error || !data.users.length) return null;
    const hit = data.users.find((u) => u.email === email);
    if (hit) return hit.id;
    if (data.users.length < 200) return null;
  }
  return null;
}

async function upsertTelegramAccount(admin: ReturnType<typeof createAdminClient>, profileId: string, u: TelegramInitUser) {
  await admin.from("telegram_accounts").upsert(
    {
      telegram_user_id: u.id,
      profile_id: profileId,
      username: u.username ?? null,
      first_name: u.first_name,
      last_name: u.last_name ?? null,
      photo_url: u.photo_url ?? null,
      language_code: u.language_code ?? null,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: "telegram_user_id" },
  );
  // Profil rasmi bo'lmasa Telegramdan olamiz
  if (u.photo_url) {
    await admin.from("profiles").update({ avatar_url: u.photo_url }).eq("id", profileId).is("avatar_url", null);
  }
}
