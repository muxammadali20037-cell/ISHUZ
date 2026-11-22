import { describe, expect, it } from "vitest";
import { isMatchNotification } from "./off";

/** Moslik o'chirilgan (ega, 2026-11-22): moslik va AI "mos e'lon" xabarlari ko'rsatilmaydi va yuborilmaydi */
describe("moslik xabarlari", () => {
  it("mos ish / mos nomzod va AI xabarnomalari — ha; boshqalari — yo'q", () => {
    expect(isMatchNotification({ type: "new_matching_vacancy", payload: {} })).toBe(true);
    expect(isMatchNotification({ type: "new_matching_worker", payload: null })).toBe(true);
    expect(isMatchNotification({ type: "system", payload: { kind: "ai_alert" } })).toBe(true);
    expect(isMatchNotification({ type: "system", payload: { kind: "ai_worker_alert" } })).toBe(true);
    expect(isMatchNotification({ type: "system", payload: { kind: "saved_search" } })).toBe(false);
    expect(isMatchNotification({ type: "system", payload: { kind: "moderation_result" } })).toBe(false);
    expect(isMatchNotification({ type: "new_message", payload: [] })).toBe(false);
  });
});
