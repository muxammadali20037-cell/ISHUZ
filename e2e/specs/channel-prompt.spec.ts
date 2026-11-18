import { expect, test, type BrowserContext } from "@playwright/test";
import { USERS, asGuest, asMode, loginAs, stack } from "../support";

/**
 * Ega (2026-11-18): "har kirganda ilovaga Telegram kanalga ulanish tugmasi chiqsin, bossa kanalga olib borsin".
 *  - har kirishda (sessiyada) bir marta, ~2.5 s dan keyin; "Keyinroq" — shu sessiyada qayta chiqmaydi, yangi kirishda yana;
 *  - "Kanalga o'tish" — kanal ochiladi va 30 kun so'ralmaydi;
 *  - tanishtiruv tugamagan bo'lsa va admin/kirish sahifalarida — chiqmaydi.
 */
async function withoutJoinedCookie(ctx: BrowserContext) {
  const keep = (await ctx.cookies()).filter((c) => c.name !== "ib_channel");
  await ctx.clearCookies();
  await ctx.addCookies(keep);
}

test("kanal taklifi: har kirishda bir marta; «Keyinroq» — yana keyingi kirishda; «Kanalga o'tish» — kanal ochiladi va boshqa so'ralmaydi", async ({ page, context }) => {
  await loginAs(context, USERS.workerA);
  await asMode(context, "worker");
  await withoutJoinedCookie(context);
  // kanal sahifasi — tashqi tarmoq yo'q: shu yerda javob beriladi
  await context.route("https://t.me/**", (r) => r.fulfill({ status: 200, contentType: "text/html", body: "<title>kanal</title>" }));

  await page.goto("/");
  const prompt = page.locator("[data-channel-prompt]");
  await expect(prompt).toBeVisible({ timeout: 10_000 });
  await expect(prompt.getByRole("heading")).toHaveText("Telegram kanalimizga qo'shiling");
  await expect(prompt).toContainText("Har kuni yangi ishlar va ishchilar — @ish_topdim_uz");
  await prompt.getByRole("button", { name: "Keyinroq" }).click();
  await expect(prompt).toHaveCount(0);

  // shu kirishda (sessiyada) — boshqa sahifalarda ham qayta chiqmaydi
  await page.goto("/jobs");
  await page.waitForTimeout(3500);
  await expect(prompt).toHaveCount(0);

  // yangi kirish (yangi oyna — yangi sessiya): yana chiqadi; "Kanalga o'tish" — kanal ochiladi
  const again = await context.newPage();
  await again.goto("/");
  const prompt2 = again.locator("[data-channel-prompt]");
  await expect(prompt2).toBeVisible({ timeout: 10_000 });
  const [popup] = await Promise.all([again.waitForEvent("popup"), prompt2.getByRole("button", { name: "Kanalga o'tish" }).click()]);
  await popup.waitForURL(/^https:\/\/t\.me\/ish_topdim_uz/);
  await popup.close();
  await expect(prompt2).toHaveCount(0);
  expect((await context.cookies()).find((c) => c.name === "ib_channel")?.value).toBe("1");

  // keyingi kirish — so'ralmaydi
  const third = await context.newPage();
  await third.goto("/");
  await third.waitForTimeout(3500);
  await expect(third.locator("[data-channel-prompt]")).toHaveCount(0);
});

test("kanal taklifi: tanishtiruv tugamagan va kirish sahifasida — chiqmaydi", async ({ page, context }) => {
  await asGuest(context);
  await withoutJoinedCookie(context);
  await page.goto("/auth");
  await page.waitForTimeout(3500);
  await expect(page.locator("[data-channel-prompt]")).toHaveCount(0);

  const host = new URL(stack.app).hostname;
  const keep = (await context.cookies()).filter((c) => c.name !== "ib_intro");
  await context.clearCookies();
  await context.addCookies(keep.map((c) => ({ ...c, domain: host })));
  const fresh = await context.newPage();
  await fresh.goto("/");
  await fresh.waitForTimeout(3500);
  await expect(fresh.locator("[data-channel-prompt]")).toHaveCount(0);
});
