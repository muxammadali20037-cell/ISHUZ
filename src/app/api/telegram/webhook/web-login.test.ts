import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * Telegram orqali kodsiz kirish (0085): "✅ Kirish" bosilgach bot o'sha xabarni "Tasdiqlandi" ga almashtiradi va pastda
 * "Ochish" tugmasini qo'yadi — u SAYTni ochadi va o'sha brauzerni ham kiritadi (bir martalik havola; ega, 2026-11-20
 * kechqurun: "Ochish bosilsa saytga olib borsin"). Havola yaratilmasa — avvalgidek Mini App.
 */
const bot = vi.hoisted(() => ({
  answerCallback: vi.fn(async () => null),
  editBotMessage: vi.fn(async () => ({ message_id: 7 }) as unknown),
  sendTelegramMessage: vi.fn(async () => ({ message_id: 8 }) as unknown),
}));
const rpc = vi.hoisted(() => vi.fn());

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({ getServerEnv: () => ({ TELEGRAM_WEBHOOK_SECRET: "s3cret", APP_URL: "https://ishuz.example" }) }));
vi.mock("@/lib/telegram/bot", async (orig) => {
  const real = await orig<typeof import("@/lib/telegram/bot")>();
  return { ...real, ...bot, syncBotMenuButtonOnce: vi.fn() };
});
vi.mock("@/features/auth/telegram-session", async (orig) => ({
  ...(await orig<typeof import("@/features/auth/telegram-session")>()),
  ensureTelegramProfile: vi.fn(async () => "11111111-1111-4111-8111-111111111111"),
}));
vi.mock("@/lib/supabase/admin", () => {
  const chain = (data: unknown) => {
    const q = { select: () => q, eq: () => q, maybeSingle: async () => ({ data, error: null }) };
    return q;
  };
  return {
    createAdminClient: () => ({
      rpc,
      from: (table: string) => chain(table === "profiles" ? { is_blocked: false } : null),
    }),
  };
});

const ID = "22222222-2222-4222-8222-222222222222";
const HID = "33333333-3333-4333-8333-333333333333";
const okRpc = async (fn: string) => ({ data: fn === "telegram_update_first_seen" ? true : fn === "telegram_web_login_create" ? HID : "ok", error: null });
const SITE = new RegExp(`^https://ishuz\\.example/api/auth/telegram-web/open\\?r=${HID}\\.[A-Za-z0-9_-]{43}&to=%2Fchat$`);
const update = (data: string) => ({
  update_id: 1001,
  callback_query: {
    id: "cb1",
    from: { id: 555, is_bot: false, first_name: "Ali", language_code: "uz" },
    message: { message_id: 7, chat: { id: 555, type: "private" } },
    data,
  },
});
const post = async (body: unknown) => {
  const { POST } = await import("./route");
  return POST(
    new NextRequest("https://ishuz.example/api/telegram/webhook", {
      method: "POST",
      headers: { "content-type": "application/json", "x-telegram-bot-api-secret-token": "s3cret" },
      body: JSON.stringify(body),
    }),
  );
};

describe("telegram webhook: kodsiz kirish tasdig'i", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rpc.mockImplementation(okRpc);
  });

  it("tasdiqlansa — o'sha xabar o'zgaradi: matn + pastda «Ochish» (sayt, bir martalik kirish havolasi)", async () => {
    const res = await post(update(`wl:${ID}`));
    expect(res.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("telegram_web_login_confirm", expect.objectContaining({ p_id: ID, p_telegram_user_id: 555 }));
    // havola uchun shu foydalanuvchiga yangi, allaqachon tasdiqlangan so'rov
    expect(rpc).toHaveBeenCalledWith("telegram_web_login_create", expect.objectContaining({ p_user_agent: "Telegram" }));
    expect(rpc).toHaveBeenCalledWith("telegram_web_login_confirm", expect.objectContaining({ p_id: HID, p_telegram_user_id: 555 }));
    expect(bot.editBotMessage).toHaveBeenCalledTimes(1);
    const [chatId, messageId, html, keyboard] = bot.editBotMessage.mock.calls[0] as unknown as [number, number, string, { inline_keyboard: { text: string; url?: string; web_app?: { url: string } }[][] }];
    expect([chatId, messageId]).toEqual([555, 7]);
    expect(html).toContain("Kirish tasdiqlandi");
    expect(html).toContain("sayt ochiladi");
    const button = keyboard.inline_keyboard[0]![0]!;
    expect(button.text).toBe("Ochish");
    expect(button.web_app).toBeUndefined();
    expect(button.url).toMatch(SITE);
    expect(bot.sendTelegramMessage).not.toHaveBeenCalled();
  });

  it("xabarni o'zgartirib bo'lmasa — yangi xabar, o'sha tugma bilan", async () => {
    bot.editBotMessage.mockResolvedValueOnce(null);
    await post(update(`wl:${ID}`));
    expect(bot.sendTelegramMessage).toHaveBeenCalledWith(555, expect.stringContaining("Kirish tasdiqlandi"), { inline_keyboard: [[{ text: "Ochish", url: expect.stringMatching(SITE) }]] });
  });

  it("sayt havolasi yaratilmasa — avvalgidek Mini App tugmasi", async () => {
    rpc.mockImplementation(async (fn: string) => (fn === "telegram_web_login_create" ? { data: null, error: { message: "x" } } : okRpc(fn)));
    await post(update(`wl:${ID}`));
    const keyboard = (bot.editBotMessage.mock.calls[0] as unknown as [number, number, string, unknown])[3];
    expect(keyboard).toEqual({ inline_keyboard: [[{ text: "Ochish", web_app: { url: "https://ishuz.example/" } }]] });
  });

  it("muddati o'tgan so'rov — tugmasiz izoh, xabar o'zgarmaydi", async () => {
    rpc.mockImplementation(async (fn: string) => ({ data: fn === "telegram_update_first_seen" ? true : "expired", error: null }));
    await post(update(`wl:${ID}`));
    expect(bot.editBotMessage).not.toHaveBeenCalled();
    expect(bot.sendTelegramMessage).toHaveBeenCalledWith(555, expect.stringContaining("muddati tugagan"));
  });
});
