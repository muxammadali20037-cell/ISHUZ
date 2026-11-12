import { expect, test } from "@playwright/test";
import { USERS, asGuest, asMode, loginAs } from "../support";

/** Rasmiy Telegram kanal (@ish_topdim_uz) va Instagram (@ishtopdim): bosilsa yangi oynada ochiladi */
const TG = "https://t.me/ish_topdim_uz";
const IG = "https://www.instagram.com/ishtopdim/";

async function expectLinks(scope: import("@playwright/test").Locator, withHandles: boolean) {
  const tg = scope.locator("a[data-social=telegram]");
  const ig = scope.locator("a[data-social=instagram]");
  await expect(tg).toHaveAttribute("href", TG);
  await expect(ig).toHaveAttribute("href", IG);
  for (const a of [tg, ig]) {
    await expect(a).toHaveAttribute("target", "_blank");
    await expect(a).toHaveAttribute("rel", /noopener/);
  }
  await expect(tg).toHaveAccessibleName("Telegram sahifamizni ochish @ish_topdim_uz");
  await expect(ig).toHaveAccessibleName("Instagram sahifamizni ochish @ishtopdim");
  if (withHandles) {
    await expect(tg).toContainText("@ish_topdim_uz");
    await expect(ig).toContainText("@ishtopdim");
  }
}

test("sayt pastki qismi, yordam va kabinet: Telegram va Instagram", async ({ page, context }) => {
  await asGuest(context);
  await asMode(context, "worker");
  await page.goto("/");
  await expectLinks(page.getByRole("contentinfo"), true);
  await page.goto("/help");
  await expectLinks(page.getByRole("main"), true);

  await loginAs(context, USERS.workerB, "aal2");
  await asMode(context, "worker");
  await page.goto("/cabinet");
  await expectLinks(page.getByRole("main"), true);
});

test("kompyuter, kirgan foydalanuvchi: yon menyuda Telegram va Instagram", async ({ page, context }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await loginAs(context, USERS.workerB, "aal2");
  await asMode(context, "worker");
  await page.goto("/saved");
  const side = page.getByRole("navigation", { name: "Kabinet menyusi" }).filter({ has: page.locator("[data-social-links]") });
  await expectLinks(side.first(), false);
  await expect(side.first().getByText("Biz ijtimoiy tarmoqlarda")).toBeVisible();
});
