import { expect, test } from "@playwright/test";
import { USERS, asMode, loginAs } from "../support";

/**
 * Ega (2026-11-16): "tugma bosilgach keyingi oynaga o'tishi sekin — tepada ko'k chiziq kutib turadi". Endi bosilgan zahoti
 * kontent o'rnida yangi sahifa skeleti, pastki menyuda bosilgan bo'lim darhol belgilanadi; server javobi kelgach — sahifa.
 * Sekin server (sovuq funksiya) taqlidi: oldindan yuklash o'chiriladi, navigatsiya javobi 1.5 s kechiktiriladi.
 */
test("sekin serverda ham: bosilgan zahoti yangi ekran skeleti va faol bo'lim; javob kelgach — haqiqiy sahifa", async ({ page, context }) => {
  // "Ishchilar" bo'limi — ish beruvchi menyusida (2026-11-20: menyu rejimga qarab)
  await loginAs(context, USERS.employer);
  await asMode(context, "employer");
  // oldindan yuklash sahifa ochilishidan boshlab o'chiq (aks holda bosishgacha yuklanib ulgurib, o'tish shundoq ham oniy bo'ladi)
  await page.route("**/*", async (route) => {
    const h = route.request().headers();
    if (h["rsc"] === "1" && h["next-router-prefetch"]) return route.abort();
    if (h["rsc"] === "1") await new Promise((r) => setTimeout(r, 1500));
    return route.continue();
  });
  await page.goto("/cabinet");
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  const nav = page.locator("nav.bottom-nav");
  const t0 = Date.now();
  // 2026-11-20: "Ishchilar" — /search?mode=workers (so'rov qismi bilan): bosilgan zahoti aynan shu bo'lim belgilanadi
  await nav.getByRole("link", { name: "Ishchilar" }).click();
  // eski sahifa ustida kutmaydi: 0.4 s ichida skelet va faol bo'lim (manzil hali o'zgarmagan)
  await expect(page.locator("[data-nav-instant]")).toBeVisible({ timeout: 400 });
  await expect(nav.getByRole("link", { name: "Ishchilar" })).toHaveAttribute("aria-current", "page");
  await expect(nav.getByRole("link", { name: "Arizalar" })).not.toHaveAttribute("aria-current", "page");
  await expect(nav.getByRole("link", { name: "Profil" })).not.toHaveAttribute("aria-current", "page");
  expect(Date.now() - t0).toBeLessThan(1200);
  expect(new URL(page.url()).pathname).toBe("/cabinet");
  // javob keldi — haqiqiy sahifa, qatlam yo'q
  await page.waitForURL(/\/search\?mode=workers/);
  await expect(page.locator("[data-nav-instant]")).toHaveCount(0);
  await expect(nav.getByRole("link", { name: "Ishchilar" })).toHaveAttribute("aria-current", "page");
});

test("sahifa bo'lmagan havola (API, fayl) va havola ichidagi tugma — qatlam chiqmaydi", async ({ page, context }) => {
  await loginAs(context, USERS.workerA);
  await asMode(context, "worker");
  await page.goto("/cabinet");
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  await page.route("**/api/health", (route) => route.fulfill({ status: 204, body: "" }));
  await page.evaluate(() => {
    const a = document.createElement("a");
    a.href = "/api/health"; a.textContent = "api"; a.id = "zz-api"; a.style.cssText = "position:fixed;top:200px;left:20px;z-index:99;padding:20px;background:#fff";
    const b = document.createElement("a");
    b.href = "/saved"; b.id = "zz-card"; b.style.cssText = "position:fixed;top:300px;left:20px;z-index:99;padding:20px;background:#fff";
    const btn = document.createElement("button"); btn.type = "button"; btn.textContent = "ichki"; btn.addEventListener("click", (e) => e.preventDefault());
    b.appendChild(btn);
    document.body.append(a, b);
  });
  await page.locator("#zz-card button").click();
  await page.waitForTimeout(400);
  await expect(page.locator("[data-nav-instant]")).toHaveCount(0);
  expect(new URL(page.url()).pathname).toBe("/cabinet");
});
