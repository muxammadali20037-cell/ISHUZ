import { expect, test } from "@playwright/test";
import { asGuest } from "../support";

/**
 * Rol tanlash (ega "MASTER PROMPT", 2026-11-16): xush kelibsiz → "Boshlash" → "Siz qaysi maqsadda keldingiz?".
 * 2026-11-17 (ega: "qaysi kasblar sizga mos — kerak emas, qayerda ishlashni xohlaysiz — kerak emas, so'rovnomani umuman olib
 * tashla"): rol tanlangach darhol bosh sahifa; eski /start/kasblar va /start/hudud havolalari bosh sahifaga olib boradi.
 */

test("ish qidiruvchi: rol → darhol bosh sahifa (kasb va hudud so'ralmaydi); eski so'rovnoma havolalari bosh sahifaga", async ({ page, context }) => {
  await asGuest(context);
  await context.clearCookies({ name: "ib_mode" });
  await page.goto("/start/rol?from=welcome");
  await expect(page.getByRole("heading", { level: 1, name: "Siz qaysi maqsadda keldingiz?" })).toBeVisible();
  await page.getByText("Men ish qidiryapman", { exact: true }).click();
  await page.getByRole("button", { name: "Davom etish" }).click();
  await page.waitForURL((u) => new URL(u).pathname === "/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Qanday ish qidiryapsiz?");
  expect((await context.cookies()).find((c) => c.name === "ib_mode")?.value).toBe("worker");

  for (const old of ["/start/kasblar", "/start/hudud"]) {
    await page.goto(old);
    await page.waitForURL((u) => new URL(u).pathname === "/");
  }
});

test("ish beruvchi rolida kasb va hudud so'ralmaydi — darhol bosh sahifa", async ({ page, context }) => {
  await asGuest(context);
  await context.clearCookies({ name: "ib_mode" });
  await page.goto("/start/rol?from=welcome");
  await page.getByText("Men xodim qidiryapman", { exact: true }).click();
  await page.getByRole("button", { name: "Davom etish" }).click();
  await page.waitForURL((u) => new URL(u).pathname === "/");
});
