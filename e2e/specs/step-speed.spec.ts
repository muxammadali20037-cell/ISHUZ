import { expect, test, type Page, type Request } from "@playwright/test";
import { asGuest, pickProfession, sql } from "../support";

/**
 * D1 · qidiruv qadamlari: kasb → viloyat → tuman telefonda almashadi (serverga so'rovsiz), natijalar serverdan.
 * Orqaga/Oldinga va sahifani yangilash har qadamda to'g'ri ekranni ko'rsatadi; natijaga o'tishda darhol kutish belgisi.
 */

/** sahifa almashtirish uchun server so'rovlari (oldindan yuklash — prefetch — hisobga kirmaydi) */
function navRequests(page: Page) {
  const list: string[] = [];
  const on = (r: Request) => {
    const h = r.headers();
    if (r.url().includes("/search") && (h["rsc"] || h["next-router-state-tree"]) && !h["next-router-prefetch"]) list.push(r.url());
  };
  page.on("request", on);
  return { list, stop: () => page.off("request", on) };
}

test("kasb → viloyat → tuman serverga so'rovsiz; orqaga, oldinga, yangilash to'g'ri", async ({ page, context }) => {
  await asGuest(context);
  await page.goto("/search?mode=jobs");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Ish qidiraman");

  const req = navRequests(page);
  await pickProfession(page, "Buxgalter", "Buxgalter");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Qaysi viloyatda?");
  await expect(page.getByText("Ish e'lonlari · Buxgalter")).toBeVisible();
  await page.getByRole("link", { name: "Toshkent shahri", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Toshkent shahri: tuman yoki shaharni tanlang");
  expect(new URL(page.url()).searchParams.get("region")).toBe("tashkent_city");
  expect(req.list).toEqual([]);

  // brauzerning Orqaga / Oldinga tugmalari
  await page.goBack();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Qaysi viloyatda?");
  expect(new URL(page.url()).searchParams.get("region")).toBeNull();
  await page.goForward();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Toshkent shahri: tuman yoki shaharni tanlang");
  // sahifadagi "Orqaga" tugmasi
  await page.getByRole("link", { name: "Orqaga" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Qaysi viloyatda?");
  expect(req.list).toEqual([]);
  req.stop();

  // yangilash: tuman qadami serverda ham to'g'ri chiziladi
  await page.getByRole("link", { name: "Toshkent shahri", exact: true }).click();
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Toshkent shahri: tuman yoki shaharni tanlang");
  await expect(page.getByText("Ish e'lonlari · Buxgalter · Toshkent shahri")).toBeVisible();

  // natijalar — serverdan
  await page.getByRole("link", { name: /^Butun shahar/ }).click();
  await expect(page.getByRole("button", { name: "O'zgartirish" })).toBeVisible();
  expect(new URL(page.url()).searchParams.get("district")).toBe("all");
});

test("natijaga o'tishda server javobi kechiksa — bosilgan qatorda darhol kutish belgisi", async ({ page, context }) => {
  await asGuest(context);
  const [n] = await sql<{ id: string }>("select id from public.profession_nodes where name_uz = 'Buxgalter' and selectable limit 1");
  await page.goto(`/search?mode=jobs&p=${n!.id}&region=tashkent_city`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Toshkent shahri: tuman yoki shaharni tanlang");
  // natija so'rovi 1,5 s kechiktiriladi
  await page.route("**/search?**district=all**", async (route) => {
    if (route.request().headers()["next-router-prefetch"]) return route.continue();
    await new Promise((r) => setTimeout(r, 1500));
    await route.continue().catch(() => {});
  });
  const t0 = Date.now();
  await page.getByRole("link", { name: /^Butun shahar/ }).click();
  await expect(page.locator("[data-step-loading]").first()).toBeVisible({ timeout: 1000 });
  expect(Date.now() - t0).toBeLessThan(1000);
  await expect(page.getByRole("button", { name: "O'zgartirish" })).toBeVisible();
});
