import fs from "node:fs";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { USERS, asGuest, loginAs, sql } from "../support";

/**
 * C1: asosiy sahifalar 360–1440 px da — WCAG 2.1 AA (axe: jiddiy/kritik buzilish yo'q), gorizontal siljish yo'q,
 * bosiladigan elementlar ≥ 24×24 px (WCAG 2.2 · 2.5.8) va ≥ 44×44 px (mobil qulaylik maqsadi). 768 px ≈ 1440 px ekranda 200% zoom.
 * Qo'shimcha: klaviatura fokusi ko'rinadi, reduced-motion'da animatsiya yo'q.
 * Natija: e2e/.stack/a11y/<sahifa>.json (hisobot uchun o'lchov).
 */

const WIDTHS = [360, 390, 430, 768, 1440];

async function buxgalter() {
  const [r] = await sql<{ id: string }>("select id from public.profession_nodes where name_uz = 'Buxgalter' and selectable limit 1");
  return r!.id;
}

const PAGES: { name: string; url: () => Promise<string>; user?: string }[] = [
  { name: "home", url: async () => "/" },
  { name: "search-start", url: async () => "/search" },
  { name: "search-results", url: async () => `/search?mode=jobs&p=${await buxgalter()}&region=all` },
  { name: "post-worker", url: async () => "/post/worker" },
  { name: "post-vacancy", url: async () => "/post/vacancy" },
  { name: "auth", url: async () => "/auth" },
  { name: "cabinet", url: async () => "/cabinet", user: USERS.workerA },
];

type Row = {
  page: string;
  width: number;
  axe: { id: string; impact: string; nodes: number; sample: string; detail: { html: string; data: unknown }[] }[];
  overflow: number;
  tiny: string[];
  under44: number;
};
const OUT = path.join(__dirname, "../.stack/a11y");

async function measure(page: Page) {
  return page.evaluate(() => {
    const overflow = document.documentElement.scrollWidth - window.innerWidth;
    const els = Array.from(document.querySelectorAll<HTMLElement>("a[href], button, input:not([type=hidden]), select, textarea, [role=button], [role=radio], [role=checkbox], [role=tab]"));
    const tiny: string[] = [];
    let under44 = 0;
    for (const el of els) {
      const r = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      if (!r.width || !r.height || style.visibility === "hidden" || el.closest("[aria-hidden=true]") || el.classList.contains("sr-only")) continue;
      // matn ichidagi havola (paragraf ichida) — 2.5.8 istisno
      const inline = el.tagName === "A" && style.display === "inline" && el.parentElement && /^(P|SPAN|LI|SMALL)$/.test(el.parentElement.tagName);
      if (inline) continue;
      const label = (el.getAttribute("aria-label") || el.textContent || el.getAttribute("name") || el.tagName).trim().replace(/\s+/g, " ").slice(0, 40);
      if (r.width < 24 || r.height < 24) tiny.push(`${label} ${Math.round(r.width)}×${Math.round(r.height)}`);
      if (r.width < 44 || r.height < 44) under44++;
    }
    return { overflow, tiny, under44 };
  });
}


for (const p of PAGES) {
  test(`a11y + responsive: ${p.name}`, async ({ page, context }) => {
    test.setTimeout(120_000);
    if (p.user) await loginAs(context, p.user);
    else await asGuest(context);
    await page.emulateMedia({ reducedMotion: "reduce" });
    const url = await p.url();
    const mine: Row[] = [];
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: width < 768 ? 800 : 900 });
      await page.goto(url);
      await page.waitForLoadState("networkidle");
      const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
      const m = await measure(page);
      mine.push({
        page: p.name,
        width,
        axe: axe.violations.map((v) => ({
          id: v.id,
          impact: v.impact ?? "",
          nodes: v.nodes.length,
          sample: v.nodes[0]?.target.join(" ") ?? "",
          detail: v.nodes.slice(0, 6).map((n) => ({ html: n.html.slice(0, 160), data: n.any[0]?.data ?? null })),
        })),
        ...m,
      });
    }
    fs.mkdirSync(OUT, { recursive: true });
    fs.writeFileSync(path.join(OUT, `${p.name}.json`), JSON.stringify(mine, null, 2));
    const serious = mine.flatMap((r) => r.axe.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${r.width}px ${v.id} (${v.nodes}) ${v.sample}`));
    expect(serious, "axe: jiddiy/kritik buzilishlar").toEqual([]);
    expect(mine.filter((r) => r.overflow > 1).map((r) => `${r.width}px +${r.overflow}px`), "gorizontal siljish").toEqual([]);
    expect(mine.flatMap((r) => r.tiny.map((t) => `${r.width}px ${t}`)), "24×24 dan kichik bosiladigan element").toEqual([]);
    expect(mine.filter((r) => r.under44 > 0).map((r) => `${r.width}px: ${r.under44}`), "44×44 dan kichik boshqaruv").toEqual([]);
  });
}

test("klaviatura: Tab bilan o'tilganda fokus har doim ko'rinadi", async ({ page, context }) => {
  await asGuest(context);
  for (const url of ["/", "/post/worker", "/search"]) {
    await page.goto(url);
    await page.waitForLoadState("networkidle");
    const invisible: string[] = [];
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press("Tab");
      const info = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el || el === document.body) return null;
        const cs = getComputedStyle(el);
        const visible = (cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0) || (cs.boxShadow && cs.boxShadow !== "none");
        return { visible, label: (el.getAttribute("aria-label") || el.textContent || el.tagName).trim().slice(0, 30) };
      });
      if (info && !info.visible) invisible.push(`${url}: ${info.label}`);
    }
    expect(invisible, "fokus halqasi ko'rinmaydigan elementlar").toEqual([]);
  }
});

test("reduced-motion: animatsiya va o'tishlar o'chadi", async ({ page, context }) => {
  await asGuest(context);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const slow = await page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>("body *"))
      .map((el) => getComputedStyle(el))
      .filter((cs) => parseFloat(cs.animationDuration) > 0.01 || parseFloat(cs.transitionDuration) > 0.01).length,
  );
  expect(slow).toBe(0);
});
