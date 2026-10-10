import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { verifyTelegramInitData, INIT_DATA_MAX_AGE_SECONDS } = await import("./verify");

const BOT = "123456:TEST_TOKEN_for_unit_tests_only";

function sign(fields: Record<string, string>, token = BOT): string {
  const dcs = Object.keys(fields)
    .sort()
    .map((k) => `${k}=${fields[k]}`)
    .join("\n");
  const secret = createHmac("sha256", "WebAppData").update(token).digest();
  const hash = createHmac("sha256", secret).update(dcs).digest("hex");
  return new URLSearchParams({ ...fields, hash }).toString();
}

const now = Date.UTC(2026, 9, 10, 12, 0, 0);
const user = JSON.stringify({ id: 777, first_name: "Ali" });

describe("verifyTelegramInitData", () => {
  it("to'g'ri imzo va yangi auth_date — foydalanuvchi", () => {
    const init = sign({ auth_date: String(now / 1000 - 60), user, query_id: "q1" });
    expect(verifyTelegramInitData(init, BOT, now)?.id).toBe(777);
  });
  it("C: soxta imzo / boshqa bot tokeni — rad", () => {
    const init = sign({ auth_date: String(now / 1000 - 60), user }, "999:OTHER");
    expect(verifyTelegramInitData(init, BOT, now)).toBeNull();
    const tampered = sign({ auth_date: String(now / 1000 - 60), user }).replace("Ali", "Bob");
    expect(verifyTelegramInitData(tampered, BOT, now)).toBeNull();
  });
  it("C: eskirgan initData (1 soatdan ortiq) — rad (qayta ishlatish oynasi qisqa)", () => {
    expect(INIT_DATA_MAX_AGE_SECONDS).toBe(3600);
    const old = sign({ auth_date: String(now / 1000 - 3601), user });
    expect(verifyTelegramInitData(old, BOT, now)).toBeNull();
  });
  it("kelajakdagi auth_date (soat farqidan ortiq) — rad", () => {
    const future = sign({ auth_date: String(now / 1000 + 600), user });
    expect(verifyTelegramInitData(future, BOT, now)).toBeNull();
  });
  it("hash yo'q / bo'sh — rad", () => {
    expect(verifyTelegramInitData("auth_date=1&user=%7B%7D", BOT, now)).toBeNull();
    expect(verifyTelegramInitData("", BOT, now)).toBeNull();
  });
});
