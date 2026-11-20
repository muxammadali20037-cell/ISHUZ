import { expect, test, type Page } from "@playwright/test";
import { USERS, asGuest, asMode, loginAs, sql } from "../support";

/**
 * Har bir tugma-havola ishlaydi (2026-11-15, egasi: "xamma narsani test qilda kirishdan boshlab rol ozgartrshgacha tugmalargacha").
 * Mehmon → kirgan ish izlovchi → rolni almashtirish → ish beruvchi: har birida sarlavha, pastki menyu, bosh sahifa va
 * "Profil" sahifasidagi barcha ichki havolalar ochib ko'riladi — "Sahifa topilmadi" ham, "Nimadir xato ketdi" ham chiqmasligi kerak.
 */

// holatni o'zgartiradigan yoki fayl qaytaradigan havolalar ochilmaydi
const SKIP = [/^\/api\//];

async function linksOn(page: Page, paths: string[]): Promise<string[]> {
  const out = new Set<string>();
  for (const p of paths) {
    await page.goto(p);
    const hrefs = await page.locator("a[href^='/']").evaluateAll((as) => as.map((a) => a.getAttribute("href") ?? ""));
    for (const h of hrefs) {
      const clean = h.split("#")[0]!;
      if (clean && !SKIP.some((re) => re.test(clean))) out.add(clean);
    }
  }
  return [...out].sort();
}

async function expectAllOpen(page: Page, links: string[]) {
  expect(links.length, "havolalar topildi").toBeGreaterThan(5);
  const broken: string[] = [];
  for (const href of links) {
    const res = await page.goto(href);
    const status = res?.status() ?? 0;
    const h1 = (await page.getByRole("heading", { level: 1 }).first().textContent({ timeout: 5_000 }).catch(() => "")) ?? "";
    if (status >= 400 || /Sahifa topilmadi|Nimadir xato ketdi/.test(h1)) broken.push(`${href} → ${status} ${h1}`.trim());
  }
  expect(broken, "ochilmagan havolalar").toEqual([]);
}

test("mehmon: bosh sahifa va kirish sahifasidagi barcha havolalar ochiladi", async ({ page, context }) => {
  test.setTimeout(240_000);
  await asGuest(context);
  await asMode(context, "worker");
  await expectAllOpen(page, await linksOn(page, ["/", "/auth?next=%2F"]));
});

test("kirgan ish izlovchi → rolni almashtiradi → ish beruvchi: har ikki tomonda barcha havolalar ochiladi", async ({ page, context }) => {
  test.setTimeout(420_000);
  const [before] = await sql<{ active_role: string }>("select active_role from public.profiles where id = $1", [USERS.workerA]);
  await sql("update public.profiles set active_role = 'worker' where id = $1", [USERS.workerA]);
  try {
    await loginAs(context, USERS.workerA);
    await asMode(context, "worker");
    // 2026-11-20: kirgan foydalanuvchining "/" — asosiy ekran (chat)
    await page.goto("/");
    await page.waitForURL(/\/chat$/);
    await expect(page.locator("#start-chat-text")).toHaveAttribute("placeholder", "Kasb, tuman, maosh…");
    await expectAllOpen(page, await linksOn(page, ["/chat", "/cabinet", "/cabinet/elonlar", "/search?mode=jobs"]));

    // rolni almashtirish — "Profil" sahifasidagi bitta tugma
    await page.goto("/cabinet");
    await page.locator("main [data-role-switch]").click();
    await page.waitForURL((u) => new URL(u).pathname === "/chat");
    await expect(page.locator("#start-chat-text")).toHaveAttribute("placeholder", "Kim kerak: kasb, tuman…");
    await expectAllOpen(page, await linksOn(page, ["/chat", "/cabinet", "/cabinet/elonlar", "/search?mode=workers"]));

    // va orqaga
    await page.goto("/cabinet");
    await page.locator("main [data-role-switch]").click();
    await expect(page.locator("[data-role-splash='worker']")).toHaveText("Siz ish izlovchi paneliga o'tdingiz");
    await page.waitForURL((u) => new URL(u).pathname === "/chat");
    await expect(page.locator("#start-chat-text")).toHaveAttribute("placeholder", "Kasb, tuman, maosh…");
    // ish izlovchi paneli — yana ko'k (binafsha rang faqat ish beruvchida)
    await expect(page.locator("html")).not.toHaveAttribute("data-panel", "employer");
  } finally {
    await sql("update public.profiles set active_role = $2 where id = $1", [USERS.workerA, before!.active_role]);
  }
});
