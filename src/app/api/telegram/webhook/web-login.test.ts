import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * Telegram orqali kodsiz kirish (0085): "✅ Kirish" bosilgach bot o'sha xabarni "Tasdiqlandi" ga almashtiradi va pastda
 * "Ochish" (Mini App) tugmasini qo'yadi — "brauzerga qayting" demaydi (ega, 2026-11-20).
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
    rpc.mockImplementation(async (fn: string) => ({ data: fn === "telegram_update_first_seen" ? true : "ok", error: null }));
  });

  it("tasdiqlansa — o'sha xabar o'zgaradi: matn + pastda «Ochish» (Mini App, bosh sahifa)", async () => {
    const res = await post(update(`wl:${ID}`));
    expect(res.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("telegram_web_login_confirm", expect.objectContaining({ p_id: ID, p_telegram_user_id: 555 }));
    expect(bot.editBotMessage).toHaveBeenCalledTimes(1);
    const [chatId, messageId, html, keyboard] = bot.editBotMessage.mock.calls[0] as unknown as [number, number, string, { inline_keyboard: { text: string; web_app?: { url: string } }[][] }];
    expect([chatId, messageId]).toEqual([555, 7]);
    expect(html).toContain("Kirish tasdiqlandi");
    expect(html).not.toMatch(/qayting/i);
    expect(keyboard.inline_keyboard).toEqual([[{ text: "Ochish", web_app: { url: "https://ishuz.example/" } }]]);
    expect(bot.sendTelegramMessage).not.toHaveBeenCalled();
  });

  it("xabarni o'zgartirib bo'lmasa — yangi xabar, o'sha tugma bilan", async () => {
    bot.editBotMessage.mockResolvedValueOnce(null);
    await post(update(`wl:${ID}`));
    expect(bot.sendTelegramMessage).toHaveBeenCalledWith(555, expect.stringContaining("Kirish tasdiqlandi"), { inline_keyboard: [[{ text: "Ochish", web_app: { url: "https://ishuz.example/" } }]] });
  });

  it("muddati o'tgan so'rov — tugmasiz izoh, xabar o'zgarmaydi", async () => {
    rpc.mockImplementation(async (fn: string) => ({ data: fn === "telegram_update_first_seen" ? true : "expired", error: null }));
    await post(update(`wl:${ID}`));
    expect(bot.editBotMessage).not.toHaveBeenCalled();
    expect(bot.sendTelegramMessage).toHaveBeenCalledWith(555, expect.stringContaining("muddati tugagan"));
  });
});
