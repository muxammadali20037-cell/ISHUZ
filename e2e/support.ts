import fs from "node:fs";
import path from "node:path";
import { Client } from "pg";
import { expect, type BrowserContext, type Page } from "@playwright/test";
import { sessionCookie } from "./stack/jwt.mjs";

/** up.sh yozgan stend ma'lumoti (tasodifiy JWT kaliti, baza, ilova manzili) */
export const stack = JSON.parse(fs.readFileSync(path.join(__dirname, ".stack/env.json"), "utf8")) as { secret: string; db: string; app: string; gateway?: string };
/** Supabase o'rnidagi lokal shlyuz (e2e/stack/gateway.mjs) */
export const gatewayUrl = stack.gateway ?? "http://localhost:54331";

export const USERS = {
  workerA: "7e2e0000-0000-4000-8000-000000000001",
  workerB: "7e2e0000-0000-4000-8000-000000000002",
  employer: "7e2e0000-0000-4000-8000-000000000003",
} as const;

const host = new URL(stack.app).hostname;

/**
 * Mehmon: cookie'lar tozalanadi, til — o'zbek lotin. Ilova rejimi (asMode) saqlanib qoladi — u qurilmadagi tanlov.
 * Birinchi ochilishdagi tanishtiruv "ko'rilgan" (ib_intro) — testlar sahifaning o'zini tekshiradi; tanishtiruvni intro.spec ochadi.
 */
export async function asGuest(ctx: BrowserContext) {
  const mode = (await ctx.cookies()).find((c) => c.name === "ib_mode");
  await ctx.clearCookies();
  await ctx.addCookies([
    { name: "ishuz_locale", value: "uz", domain: host, path: "/" },
    { name: "ib_intro", value: "1", domain: host, path: "/" },
    ...(mode ? [{ name: "ib_mode", value: mode.value, domain: host, path: "/" }] : []),
  ]);
}

/** Shu foydalanuvchi sifatida "kirish" (sessiya cookie'si sinov kaliti bilan imzolangan). `aal2` — ikki bosqichli kirish o'tilgan (admin panel) */
export async function loginAs(ctx: BrowserContext, userId: string, aal: "aal1" | "aal2" = "aal1") {
  await asGuest(ctx);
  const c = sessionCookie(userId, stack.secret, aal);
  await ctx.addCookies([{ ...c, domain: host, path: "/" }]);
}

/** Ilova rejimi (ish izlovchi / ish beruvchi) — shu qurilmadagi tanlov; asGuest/loginAs undan keyin ham saqlaydi */
export async function asMode(ctx: BrowserContext, mode: "worker" | "employer") {
  await ctx.addCookies([{ name: "ib_mode", value: mode, domain: host, path: "/" }]);
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

/** Forma serverda darhol chiziladi, lekin qurilmadagi qoralama o'qilguncha (inert, aria-busy) bosilmaydi — foydalanuvchi kabi kutamiz */
export async function formReady(page: Page) {
  await expect(page.locator('[aria-busy="true"][inert]')).toHaveCount(0);
}

/** Kasb tanlagichda qidirib, aynan shu nomli tanlanadigan kasbni ("Tanlash") tanlash — "Buxgalteriya" sohasini emas */
export async function pickProfession(page: Page, query: string, exact: string) {
  await formReady(page);
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
  await page.getByRole("radio", { name: /^Butun (viloyat|shahar)/ }).click();
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
