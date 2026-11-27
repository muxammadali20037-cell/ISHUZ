import { expect, test } from "@playwright/test";
import { asGuest } from "../support";

/**
 * Rol tanlash: "Ish yoki ishchi qidiryapsizmi?" — ikkita tugma, bitta bosishda (2026-11-20, 2026-11-27).
 * 2026-11-17 (ega: "qaysi kasblar sizga mos — kerak emas, qayerda ishlashni xohlaysiz — kerak emas, so'rovnomani umuman olib
 * tashla"): rol tanlangach darhol bosh sahifa; eski /start/kasblar va /start/hudud havolalari bosh sahifaga olib boradi.
 */

test("ish qidiruvchi: rol → darhol asosiy ekran — chat (kasb va hudud so'ralmaydi); eski so'rovnoma havolalari bosh sahifaga", async ({ page, context }) => {
  await asGuest(context);
  await context.clearCookies({ name: "ib_mode" });
  await page.goto("/start/rol?from=welcome");
  await expect(page.getByRole("heading", { level: 1, name: "Ish yoki ishchi qidiryapsizmi?" })).toBeVisible();
  await page.locator("[data-role-choice='worker']").click();
  // 2026-11-20: rol tanlangach — asosiy ekran (chat), ish qidiruvi bilan
  await page.waitForURL((u) => new URL(u).pathname === "/chat");
  await expect(page.locator("#start-chat-text")).toHaveAttribute("placeholder", "Masalan: men oshpazman");
  expect((await context.cookies()).find((c) => c.name === "ib_mode")?.value).toBe("worker");

  for (const old of ["/start/kasblar", "/start/hudud"]) {
    await page.goto(old);
    await page.waitForURL((u) => new URL(u).pathname === "/");
  }
});

test("ish beruvchi rolida kasb va hudud so'ralmaydi — darhol asosiy ekran (chat)", async ({ page, context }) => {
  await asGuest(context);
  await context.clearCookies({ name: "ib_mode" });
  await page.goto("/start/rol?from=welcome");
  await page.locator("[data-role-choice='employer']").click();
  await page.waitForURL((u) => new URL(u).pathname === "/chat");
  await expect(page.locator("#start-chat-text")).toHaveAttribute("placeholder", "Masalan: menga sotuvchi kerak");
});
