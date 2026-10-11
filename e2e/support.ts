import fs from "node:fs";
import path from "node:path";
import { Client } from "pg";
import type { BrowserContext, Page } from "@playwright/test";
import { sessionCookie } from "./stack/jwt.mjs";

/** up.sh yozgan stend ma'lumoti (tasodifiy JWT kaliti, baza, ilova manzili) */
export const stack = JSON.parse(fs.readFileSync(path.join(__dirname, ".stack/env.json"), "utf8")) as { secret: string; db: string; app: string };

export const USERS = {
  workerA: "7e2e0000-0000-4000-8000-000000000001",
  workerB: "7e2e0000-0000-4000-8000-000000000002",
  employer: "7e2e0000-0000-4000-8000-000000000003",
} as const;

const host = new URL(stack.app).hostname;

/** Birinchi tashrif oynasi va til tanlovi o'tkazib yuboriladi (o'zbek lotin) */
export async function asGuest(ctx: BrowserContext) {
  await ctx.clearCookies();
  await ctx.addCookies([
    { name: "ishuz_welcome", value: "1", domain: host, path: "/" },
    { name: "ishuz_locale", value: "uz", domain: host, path: "/" },
  ]);
}

/** Shu foydalanuvchi sifatida "kirish" (sessiya cookie'si sinov kaliti bilan imzolangan) */
export async function loginAs(ctx: BrowserContext, userId: string) {
  await asGuest(ctx);
  const c = sessionCookie(userId, stack.secret);
  await ctx.addCookies([{ ...c, domain: host, path: "/" }]);
}

export async function sql<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T[]> {
  const client = new Client({ connectionString: stack.db });
  await client.connect();
  try {
    return (await client.query(text, params)).rows as T[];
  } finally {
    await client.end();
  }
}

/** localStorage'dagi qoralama kalitlari va ularning egasi */
export async function draftKeys(page: Page): Promise<string[]> {
  return page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("ib_draft:")));
}

/** Kasb tanlagichda qidirib, aynan shu nomli tanlanadigan kasbni ("Tanlash") tanlash — "Buxgalteriya" sohasini emas */
export async function pickProfession(page: Page, query: string, exact: string) {
  await page.getByLabel("Kasb yoki sohani qidiring").fill(query);
  await page
    .getByRole("button")
    .filter({ has: page.getByText(exact, { exact: true }) })
    .filter({ hasText: "Tanlash" })
    .first()
    .click();
}

/** Hudud: viloyat → butun viloyat */
export async function pickWholeRegion(page: Page, region = "Toshkent shahri") {
  await page.getByRole("button", { name: new RegExp(`^${region}`) }).first().click();
  await page.getByRole("radio", { name: /^Butun viloyat/ }).click();
}

export async function next(page: Page) {
  await page.getByRole("button", { name: /^Davom etish/ }).click();
}

/** Shu foydalanuvchining qoralamasidagi ma'lumot (localStorage) */
export async function draftData(page: Page, key: string): Promise<Record<string, unknown> | null> {
  return page.evaluate((k) => {
    const raw = localStorage.getItem(k);
    return raw ? (JSON.parse(raw).data as Record<string, unknown>) : null;
  }, key);
}
