import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** Kanalga avtomatik e'lon: oddiy matn, havola ko'rinishi o'chiq, bitta tugma — rasm yo'q (ega, 2026-11-16) */
vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({ getServerEnv: () => ({ TELEGRAM_BOT_TOKEN: "x" }), testOnlyOverride: () => undefined }));
vi.mock("@/lib/telegram/bot", () => ({ escapeHtml: (s: string) => s, miniAppBaseUrl: () => "https://ishuz.vercel.app" }));

const { sendChannelMessage } = await import("./channel");
const calls: { method: string; body: Record<string, unknown> }[] = [];

beforeEach(() => {
  calls.length = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: { body: string }) => {
      calls.push({ method: url.split("/").at(-1)!, body: JSON.parse(init.body) });
      return new Response(JSON.stringify({ ok: true, result: { message_id: 5 } }));
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

describe("kanalga e'lon yuborish", () => {
  it("oddiy matn + «Ariza qoldirish» tugmasi; havola ko'rinishi (sayt nomi, rasm) o'chiq", async () => {
    const r = await sendChannelMessage({ chatId: "@kanal", html: "<b>Oshpaz</b>", button: { text: "Ariza qoldirish", url: "https://ishuz.vercel.app/jobs/oshpaz-1" } });
    expect(r).toEqual({ ok: true, messageId: 5 });
    expect(calls.map((c) => c.method)).toEqual(["sendMessage"]);
    expect(calls[0]!.body).toMatchObject({ chat_id: "@kanal", text: "<b>Oshpaz</b>", parse_mode: "HTML", link_preview_options: { is_disabled: true } });
    expect(calls[0]!.body.reply_markup).toEqual({ inline_keyboard: [[{ text: "Ariza qoldirish", url: "https://ishuz.vercel.app/jobs/oshpaz-1" }]] });
  });
});
