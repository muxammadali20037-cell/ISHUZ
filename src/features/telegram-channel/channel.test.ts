import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Kanalga avtomatik e'lon (ega, 2026-11-16): vakansiya — oddiy rasm + izohda vakansiya nomi + "Ariza qoldirish" tugmasi;
 * rasm ketmasa — to'liq matn, havola ko'rinishi o'chiq (sayt nomi chiqmaydi).
 */
vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({ getServerEnv: () => ({ TELEGRAM_BOT_TOKEN: "x" }), testOnlyOverride: () => undefined }));
vi.mock("@/lib/telegram/bot", () => ({ escapeHtml: (s: string) => s, miniAppBaseUrl: () => "https://ishuz.vercel.app" }));

const { sendChannelMessage } = await import("./channel");
const calls: { method: string; body: Record<string, unknown> }[] = [];
let photoFails = false;

beforeEach(() => {
  calls.length = 0;
  photoFails = false;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: { body: string }) => {
      const method = url.split("/").at(-1)!;
      calls.push({ method, body: JSON.parse(init.body) });
      if (method === "sendPhoto" && photoFails) return new Response(JSON.stringify({ ok: false, error_code: 400, description: "Bad Request: wrong file identifier/HTTP URL specified" }), { status: 400 });
      return new Response(JSON.stringify({ ok: true, result: { message_id: 5 } }));
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

const BUTTON = { text: "Ariza qoldirish", url: "https://ishuz.vercel.app/jobs/oshpaz-1" };
const KEYBOARD = { inline_keyboard: [[BUTTON]] };

describe("kanalga e'lon yuborish", () => {
  it("rasm + qisqa izoh (vakansiya nomi) + «Ariza qoldirish» tugmasi", async () => {
    const r = await sendChannelMessage({ chatId: "@kanal", html: "<b>Oshpaz</b>\n📍 Toshkent", caption: "<b>Oshpaz</b>", photo: "https://ishuz.vercel.app/api/promo/vacancy/oshpaz-1?f=post", button: BUTTON });
    expect(r).toEqual({ ok: true, messageId: 5 });
    expect(calls.map((c) => c.method)).toEqual(["sendPhoto"]);
    expect(calls[0]!.body).toMatchObject({ chat_id: "@kanal", caption: "<b>Oshpaz</b>", parse_mode: "HTML", photo: "https://ishuz.vercel.app/api/promo/vacancy/oshpaz-1?f=post" });
    expect(calls[0]!.body.reply_markup).toEqual(KEYBOARD);
  });

  it("rasm ketmasa — to'liq matn, havola ko'rinishi o'chiq", async () => {
    photoFails = true;
    const r = await sendChannelMessage({ chatId: "@kanal", html: "<b>Oshpaz</b>\n📍 Toshkent", caption: "<b>Oshpaz</b>", photo: "https://x/p.png", button: BUTTON });
    expect(r).toEqual({ ok: true, messageId: 5 });
    expect(calls.map((c) => c.method)).toEqual(["sendPhoto", "sendMessage"]);
    expect(calls[1]!.body).toMatchObject({ text: "<b>Oshpaz</b>\n📍 Toshkent", link_preview_options: { is_disabled: true } });
    expect(calls[1]!.body.reply_markup).toEqual(KEYBOARD);
  });

  it("rasmsiz e'lon (ishchi) — oddiy matn", async () => {
    await sendChannelMessage({ chatId: "@kanal", html: "<b>Oshpaz</b>", button: BUTTON });
    expect(calls.map((c) => c.method)).toEqual(["sendMessage"]);
  });
});
