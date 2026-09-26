import { describe, expect, it } from "vitest";
import { isTelegramBlockedError, parseBotCommand, resolveTelegramLocale, telegramUpdateSchema } from "./telegram";

describe("telegram webhook helpers", () => {
  it("update sxemasi: message bilan", () => {
    const parsed = telegramUpdateSchema.safeParse({
      update_id: 1,
      message: { message_id: 5, text: "/start", from: { id: 42, first_name: "Ali", language_code: "uz" }, chat: { id: 42, type: "private" }, date: 1 },
    });
    expect(parsed.success).toBe(true);
    expect(parsed.data?.message?.from?.id).toBe(42);
  });
  it("update sxemasi: message'siz update ham to'g'ri (e'tiborsiz qoladi)", () => {
    const parsed = telegramUpdateSchema.safeParse({ update_id: 2, callback_query: { id: "x" } });
    expect(parsed.success).toBe(true);
    expect(parsed.data?.message).toBeUndefined();
  });
  it("noto'g'ri update rad etiladi", () => {
    expect(telegramUpdateSchema.safeParse({ message: {} }).success).toBe(false);
  });
  it("parseBotCommand", () => {
    expect(parseBotCommand("/start")).toEqual({ name: "start", param: null });
    expect(parseBotCommand("/start ref_abc-1")).toEqual({ name: "start", param: "ref_abc-1" });
    expect(parseBotCommand("/START@ishuz_bot  x")).toEqual({ name: "start", param: "x" });
    expect(parseBotCommand("/start <script>")).toEqual({ name: "start", param: null });
    expect(parseBotCommand("salom")).toBeNull();
    expect(parseBotCommand(undefined)).toBeNull();
  });
  it("resolveTelegramLocale", () => {
    expect(resolveTelegramLocale(["ru", "uz"])).toBe("ru");
    expect(resolveTelegramLocale([null, undefined, "en", "uz-UZ"])).toBe("uz");
    expect(resolveTelegramLocale([undefined, "ru-RU"])).toBe("ru");
    expect(resolveTelegramLocale(["en"])).toBe("uz");
  });
  it("isTelegramBlockedError", () => {
    expect(isTelegramBlockedError(403, "Forbidden: bot was blocked by the user")).toBe(true);
    expect(isTelegramBlockedError(400, "Bad Request: chat not found")).toBe(true);
    expect(isTelegramBlockedError(429, "Too Many Requests")).toBe(false);
    expect(isTelegramBlockedError(undefined, undefined)).toBe(false);
  });
});
