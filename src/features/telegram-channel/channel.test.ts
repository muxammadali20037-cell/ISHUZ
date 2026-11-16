import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Kanalga avtomatik e'lon yuborish (sendChannelMessage): vakansiya rasm bilan (sendPhoto); Telegram rasmni ololmasa —
 * o'sha xabar matn bilan ketadi; kanal darajasidagi xato (bot admin emas) — matn bilan qayta urinilmaydi.
 */
vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({ getServerEnv: () => ({ TELEGRAM_BOT_TOKEN: "x" }), testOnlyOverride: () => undefined }));
vi.mock("@/lib/telegram/bot", () => ({ escapeHtml: (s: string) => s, miniAppBaseUrl: () => "https://ishuz.vercel.app" }));

const { sendChannelMessage } = await import("./channel");

const calls: { method: string; body: Record<string, unknown> }[] = [];
let replies: Record<string, unknown>[] = [];

beforeEach(() => {
  calls.length = 0;
  replies = [];
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: { body: string }) => {
      calls.push({ method: url.split("/").at(-1)!, body: JSON.parse(init.body) });
      return new Response(JSON.stringify(replies.shift() ?? { ok: true, result: { message_id: 1 } }));
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

const base = { chatId: "@kanal", html: "<b>Oshpaz</b>", button: { text: "Ochish", url: "https://ishuz.vercel.app/jobs/oshpaz-1" } };

describe("kanalga e'lon yuborish", () => {
  it("rasm bilan: sendPhoto, izoh va tugma bilan", async () => {
    replies = [{ ok: true, result: { message_id: 7 } }];
    expect(await sendChannelMessage({ ...base, photo: "https://ishuz.vercel.app/api/promo/vacancy/oshpaz-1?f=square" })).toEqual({ ok: true, messageId: 7 });
    expect(calls.map((c) => c.method)).toEqual(["sendPhoto"]);
    expect(calls[0]!.body).toMatchObject({ chat_id: "@kanal", photo: "https://ishuz.vercel.app/api/promo/vacancy/oshpaz-1?f=square", caption: "<b>Oshpaz</b>", parse_mode: "HTML" });
    expect(calls[0]!.body.reply_markup).toEqual({ inline_keyboard: [[{ text: "Ochish", url: "https://ishuz.vercel.app/jobs/oshpaz-1" }]] });
  });

  it("Telegram rasmni ololmasa — o'sha xabar matn bilan", async () => {
    replies = [{ ok: false, error_code: 400, description: "Bad Request: failed to get HTTP URL content" }, { ok: true, result: { message_id: 9 } }];
    expect(await sendChannelMessage({ ...base, photo: "https://ishuz.vercel.app/x.png" })).toEqual({ ok: true, messageId: 9 });
    expect(calls.map((c) => c.method)).toEqual(["sendPhoto", "sendMessage"]);
    expect(calls[1]!.body).toMatchObject({ text: "<b>Oshpaz</b>", parse_mode: "HTML" });
  });

  it("kanal darajasidagi xato — matn bilan qayta urinilmaydi", async () => {
    replies = [{ ok: false, error_code: 403, description: "Forbidden: bot is not a member of the channel chat" }];
    expect(await sendChannelMessage({ ...base, photo: "https://ishuz.vercel.app/x.png" })).toMatchObject({ ok: false, channelLevel: true });
    expect(calls.map((c) => c.method)).toEqual(["sendPhoto"]);
  });

  it("rasmsiz (ishchi e'loni) — oddiy matn", async () => {
    await sendChannelMessage(base);
    expect(calls.map((c) => c.method)).toEqual(["sendMessage"]);
  });
});
