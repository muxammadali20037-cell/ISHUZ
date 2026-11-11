import { expect, test, type Page } from "@playwright/test";
import { USERS, asGuest, asMode, sql } from "../support";

/**
 * AI yordamchi — suhbat dvigateli (POST /api/assistant, NDJSON oqimi). Stendda AI kaliti yo'q: javob lug'at va shablon bilan
 * (manba "rules") — xuddi shu yo'l AI ishlamay qolganda ham ishlaydi. Tekshiriladi: natijalar faqat bazadan, javob
 * foydalanuvchi tilida, salomlashuvda qidiruv yo'q, ish beruvchi rejimida — nomzodlar, himoya (faqat JSON, o'z saytimizdan).
 */

const TITLE = "Oshpaz — Samarqand (AI yordamchi)";

type Event = { type: string; [k: string]: unknown };

async function chat(page: Page, messages: Array<{ role: "user" | "assistant"; text: string }>, role?: "seeker" | "employer") {
  return page.evaluate(
    async ({ messages, role }) => {
      const res = await fetch("/api/assistant", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages, role }) });
      const text = await res.text();
      return { status: res.status, type: res.headers.get("content-type"), lines: text.split("\n").filter(Boolean) };
    },
    { messages, role },
  );
}
const events = (lines: string[]) => lines.map((l) => JSON.parse(l) as Event);
const textOf = (ev: Event[]) => ev.filter((e) => e.type === "text").map((e) => e.delta as string).join("");

test.beforeEach(async () => {
  await sql("delete from public.vacancies where owner_profile_id = $1", [USERS.employer]);
  await sql(
    `insert into public.employer_profiles (profile_id, employer_type, display_name, onboarding_completed_at)
     values ($1, 'person', 'Dilnoza opa', now()) on conflict (profile_id) do nothing`,
    [USERS.employer],
  );
  await sql(
    `insert into public.vacancies (owner_profile_id, title, region_id, profession_node_id, description, status, salary_from, salary_type, published_at, expires_at)
     select $1, $2, r.id, n.id, 'Milliy taomlar oshpazi kerak, smena 2/2, ovqat bilan.', 'active', 5000000, 'monthly', now(), now() + interval '10 days'
     from public.regions r cross join (select id from public.profession_nodes where name_uz = 'Oshpaz' and selectable order by depth limit 1) n
     where r.slug = 'samarkand'`,
    [USERS.employer, TITLE],
  );
});
test.afterAll(async () => {
  await sql("delete from public.vacancies where owner_profile_id = $1", [USERS.employer]);
});

test("ish izlovchi: matn → bazadagi haqiqiy e'lon (kengaytirish bilan), o'zbekcha javob, keyingi savollar", async ({ page, context }) => {
  await asGuest(context);
  await asMode(context, "worker");
  await page.goto("/ai");
  const res = await chat(page, [{ role: "user", text: "Chilonzorda oshpaz ish kerak" }]);
  expect(res.status).toBe(200);
  expect(res.type).toContain("application/x-ndjson");
  const ev = events(res.lines);
  expect(ev.map((e) => e.type)).toEqual(["status", "results", "text", "suggestions", "done"]);
  const data = ev.find((e) => e.type === "results")!.data as { mode: string; total: number; jobs: Array<{ title: string; phone: string | null }>; relaxed: string[] };
  expect(data.mode).toBe("jobs");
  expect(data.jobs.map((j) => j.title)).toEqual([TITLE]);
  // qidiruv natijasida telefon qaytmaydi (0074) — yordamchi orqali ham
  expect(data.jobs.every((j) => j.phone == null)).toBe(true);
  // Chilonzorda yo'q — kengaytirilgani aytiladi; son bazadan
  expect(data.relaxed.join(" ")).toContain("butun O'zbekiston bo'yicha ko'rsatildi");
  expect(textOf(ev)).toContain("1 ta");
  expect(textOf(ev)).toContain("kengaytirdim");
  // natija bor va AI ulanmagan: toraytirish tugmalarini oyna o'zi ko'rsatadi — AI kerak bo'ladigan savol taklif qilinmaydi
  expect(ev.find((e) => e.type === "suggestions")!.items).toEqual([]);
  expect(ev.at(-1)).toEqual({ type: "done", source: "rules", lang: "uz" });
});

test("til: ruscha yozsa — ruscha, kirillda o'zbekcha yozsa — kirillda, inglizcha — inglizcha javob", async ({ page, context }) => {
  await asGuest(context);
  await asMode(context, "worker");
  await page.goto("/ai");
  const ru = events((await chat(page, [{ role: "user", text: "ищу работу поваром в Самарканде" }])).lines);
  expect(ru.at(-1)).toMatchObject({ type: "done", lang: "ru" });
  expect(textOf(ru)).toMatch(/объявлен/);
  const oz = events((await chat(page, [{ role: "user", text: "Самарқандда ошпаз иш керак" }])).lines);
  expect(oz.at(-1)).toMatchObject({ type: "done", lang: "oz" });
  expect(textOf(oz)).toMatch(/эълон/);
  const en = events((await chat(page, [{ role: "user", text: "hello" }])).lines);
  expect(en.at(-1)).toMatchObject({ type: "done", lang: "en" });
  expect(textOf(en)).toContain("AI assistant");
  // salomlashuvda bazaga murojaat yo'q
  expect(en.map((e) => e.type)).not.toContain("results");
});

test("hech narsa yo'q — halol javob, o'ylab topilgan e'lon yo'q", async ({ page, context }) => {
  await sql("delete from public.vacancies where owner_profile_id = $1", [USERS.employer]);
  await asGuest(context);
  await asMode(context, "worker");
  await page.goto("/ai");
  const ev = events((await chat(page, [{ role: "user", text: "Toshkentda elektrik ish kerak" }])).lines);
  const data = ev.find((e) => e.type === "results")!.data as { total: number; jobs: unknown[]; alertHref: string };
  expect(data.total).toBe(0);
  expect(data.jobs).toEqual([]);
  expect(data.alertHref).toContain("/ai-alerts?role=worker");
  expect(textOf(ev)).toMatch(/yo'q|topilmadi/);
  expect(ev.find((e) => e.type === "suggestions")!.items).toEqual(["Kunlik ish bormi?", "Tajribasiz ishlar", "Uydan ishlash"]);
});

test("suhbat konteksti (AI'siz): 'oshpaz kerak' → 'Samarqandda' — kasb oldingi xabardan olinadi", async ({ page, context }) => {
  await asGuest(context);
  await asMode(context, "worker");
  await page.goto("/ai");
  const ev = events(
    (
      await chat(page, [
        { role: "user", text: "oshpaz kerak" },
        { role: "assistant", text: "Qaysi hududda?" },
        { role: "user", text: "Samarqandda" },
      ])
    ).lines,
  );
  const data = ev.find((e) => e.type === "results")!.data as { understood: string[]; jobs: Array<{ title: string }>; relaxed: string[] };
  expect(data.understood).toEqual(expect.arrayContaining(["Oshpaz"]));
  expect(data.understood.join(" ")).toContain("Samarqand");
  expect(data.jobs.map((j) => j.title)).toEqual([TITLE]);
  expect(data.relaxed).toEqual([]);
});

test("ish beruvchi rejimi: nomzodlar ichidan qidiradi (rejim so'rovdagi rol bilan almashtirilmaydi)", async ({ page, context }) => {
  await asGuest(context);
  await asMode(context, "employer");
  await page.goto("/ai");
  const ev = events((await chat(page, [{ role: "user", text: "sotuvchi kerak" }], "seeker")).lines);
  const data = ev.find((e) => e.type === "results")!.data as { mode: string; jobs: unknown[] };
  expect(data.mode).toBe("workers");
  expect(data.jobs).toEqual([]);
});

test("himoya: JSON bo'lmagan va noto'g'ri so'rov rad etiladi; oxirgi xabar foydalanuvchiniki bo'lishi kerak", async ({ page, context }) => {
  await asGuest(context);
  await asMode(context, "worker");
  await page.goto("/ai");
  const bad = await page.evaluate(async () => {
    const form = await fetch("/api/assistant", { method: "POST", headers: { "Content-Type": "text/plain" }, body: "{}" });
    const empty = await fetch("/api/assistant", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: [] }) });
    const huge = await fetch("/api/assistant", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: [{ role: "user", text: "x".repeat(5000) }] }) });
    return [form.status, empty.status, huge.status];
  });
  expect(bad).toEqual([415, 400, 400]);
  const ev = events((await chat(page, [{ role: "user", text: "salom" }, { role: "assistant", text: "Assalomu alaykum" }])).lines);
  expect(ev).toEqual([{ type: "error", code: "validation" }]);
  // boshqa saytdan yuborilgan so'rov (Origin boshqa) — rad
  const cross = await page.request.post("/api/assistant", { headers: { "Content-Type": "application/json", Origin: "https://evil.example" }, data: { messages: [{ role: "user", text: "salom" }] } });
  expect(cross.status()).toBe(403);
});
