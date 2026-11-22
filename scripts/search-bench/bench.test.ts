/**
 * Qidiruv benchmarki (ega, 2026-11-22: "qidiruv uchun alohida benchmark — kamida 1000 ta namunaviy vakansiyada relevantlik
 * va tezlik; test ma'lumotlari prod bazaga joylanmasin"). Haqiqiy server kodi: resolveFindQuery (matn → kasb), familyOf
 * (butun soha), findJobs / findJobsInCategory / findJobsByText — LOKAL E2E STEND bazasiga qarshi.
 *
 *   bash e2e/stack/up.sh                         # stend
 *   psql "$E2E_DB_URL" -f scripts/search-bench/seed.sql   # 1200+ namunaviy vakansiya (faqat ishuz_e2e)
 *   npm run bench:search                         # natija: e2e/.stack/search-bench.json
 *
 * Talab: kutilgan kasb ≥ 90% so'rovda, umumiy so'rov ("ish kerak", "работа") — kasbsiz; p95 (tushunish + qidiruv) < 500 ms.
 */
import { writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

const env = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require("node:fs") as typeof import("node:fs");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const cp = require("node:child_process") as typeof import("node:child_process");
  // e2e/stack/up.sh yozadi; stend ishlamayotgan bo'lsa — aniq xato
  const st = JSON.parse(fs.readFileSync("e2e/.stack/env.json", "utf8")) as { secret: string; gateway: string };
  const key = (role: string) => cp.execSync(`node e2e/stack/jwt.mjs role ${role}`, { env: { ...process.env, E2E_JWT_SECRET: st.secret } }).toString().trim();
  const anon = key("anon");
  const service = key("service_role");
  process.env.NEXT_PUBLIC_SUPABASE_URL = st.gateway;
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = anon;
  process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3300";
  process.env.SUPABASE_SERVICE_ROLE_KEY = service;
  return { url: st.gateway, anon, service };
});

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn, revalidateTag: () => {}, revalidatePath: () => {} }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }), headers: async () => new Headers() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => createClient(env.url, env.anon, { auth: { persistSession: false } }) }));
vi.mock("@/lib/profession-images/server", () => ({ getProfessionImages: async () => ({}) }));

type Case = { q: string; expect?: RegExp; generic?: boolean; note?: string };

const CASES: Case[] = [
  // egasining 4 ta misoli
  { q: "ish kerak", generic: true },
  { q: "voditel", expect: /haydovchi/i },
  { q: "oshpaz", expect: /oshpaz/i },
  { q: "работа", generic: true },
  // lotin / kirill / rus
  { q: "ошпаз", expect: /oshpaz/i },
  { q: "повар", expect: /oshpaz/i },
  { q: "haydovchi", expect: /haydovchi/i },
  { q: "ҳайдовчи", expect: /haydovchi/i },
  { q: "водитель", expect: /haydovchi/i },
  { q: "sotuvchi", expect: /sotuvchi/i },
  { q: "продавец", expect: /sotuvchi/i },
  { q: "prodavets", expect: /sotuvchi/i },
  { q: "quruvchi", expect: /quruvchi|qurilish/i },
  { q: "строитель", expect: /quruvchi|qurilish/i },
  { q: "konchi", expect: /konchi|shaxt/i },
  { q: "шахтёр", expect: /konchi|shaxt/i },
  { q: "buxgalter", expect: /buxgalter/i },
  { q: "бухгалтер", expect: /buxgalter/i },
  { q: "buhgalter", expect: /buxgalter/i },
  { q: "programist", expect: /dastur|developer|программист/i },
  { q: "программист", expect: /dastur|developer|программист/i },
  { q: "dasturchi", expect: /dastur|developer/i },
  // imlo xatolari
  { q: "oshpz", expect: /oshpaz/i },
  { q: "haydochi", expect: /haydovchi/i },
  { q: "kasir", expect: /kassir/i },
  { q: "elektirk", expect: /elektr/i },
  { q: "santexnk", expect: /santexnik/i },
  { q: "oqituvchi", expect: /o'qituvchi|oqituvchi/i },
  // boshqa ko'p so'raladigan
  { q: "kassir", expect: /kassir/i },
  { q: "farrosh", expect: /farrosh|tozala/i },
  { q: "уборщица", expect: /farrosh|tozala/i },
  { q: "ofitsiant", expect: /ofitsiant/i },
  { q: "официант", expect: /ofitsiant/i },
  { q: "qorovul", expect: /qorovul|xavfsizlik|qo'riqchi/i },
  { q: "охранник", expect: /qorovul|xavfsizlik|qo'riqchi/i },
  { q: "kuryer", expect: /kuryer|курьер|yetkaz/i },
  { q: "курьер", expect: /kuryer|курьер|yetkaz/i },
  { q: "grushik", expect: /yuk/i },
  { q: "грузчик", expect: /yuk/i },
  { q: "сварщик", expect: /payvand/i },
  { q: "швея", expect: /tikuvchi/i },
  { q: "парикмахер", expect: /sartarosh/i },
  { q: "няня", expect: /enaga/i },
  { q: "медсестра", expect: /hamshira/i },
  // gaplar
  { q: "Toshkentda oshpaz kerak", expect: /oshpaz/i },
  { q: "menga haydovchi ishi kerak", expect: /haydovchi/i },
  { q: "ищу работу водителем", expect: /haydovchi/i },
  { q: "работа поваром", expect: /oshpaz/i },
  // umumiy
  { q: "ish bormi", generic: true },
  { q: "menga ish kerak", generic: true },
  { q: "нужна работа", generic: true },
  { q: "ish", generic: true },
  { q: "vakansiya", generic: true },
  // prod jurnalidagi haqiqiy so'rovlar
  { q: "kunlik ishlar", generic: true, note: "kunlik filtri" },
  { q: "kunlik ish mardikor", expect: /mardikor|yordamchi ishchi|kunlik/i },
  { q: "it", expect: /dastur|developer|разработчик|программист|tester|qa|admin|dizayn|designer|ma'lumot|data|analitik|support|devops|\bit\b|ux|ui/i },
  { q: "logist", expect: /logist/i },
  { q: "mexanik", expect: /mexanik/i },
  { q: "moliyachi", expect: /moliya/i },
  { q: "manual qa", expect: /test|qa/i },
  { q: "ux tadqiqotchi", expect: /ux/i },
  // "Baliqchi" — Andijondagi tuman nomi ham: hudud deb tushuniladi (ataylab; kutilgan kasb tekshirilmaydi)
  { q: "baliqchi", note: "tuman nomi bilan bir xil" },
  { q: "terapevt", expect: /terapevt/i },
  { q: "okituvchi", expect: /o'qituvchi/i },
  // ikkinchi so'zdagi imlo xatosi hali tuzatilmaydi — "O'qituvchi" guruhi (natija baribir o'qituvchilar)
  { q: "o'qituvchi matimatika", expect: /o'qituvchi/i },
  { q: "konchi shaxtyor", expect: /konchi/i },
  { q: "full stack dasturchi", expect: /full|dastur/i },
  { q: "vue dasturchi", expect: /frontend|dastur|vue/i },
  { q: "tayanch doktorant phd", expect: /doktorant|phd/i },
  { q: "nazariya o'qituvchisi yhq", expect: /nazariya|haydovchilik|avtoinstruktor/i },
  { q: "stomatolog terapevt", expect: /stomatolog/i },
  { q: "boshlang'ich sinf o'qituvchisi", expect: /boshlang'ich/i },
  { q: "qurilish muhandisi", expect: /qurilish muhandis/i },
  { q: "gruzchik", expect: /yuk/i },
  { q: "taksist", expect: /taksi|haydovchi/i },
  { q: "povar", expect: /oshpaz/i },
  { q: "ohrana", expect: /qo'riqchi|qorovul/i },
  { q: "uborshitsa", expect: /farrosh|tozala/i },
  { q: "kuryer", expect: /kuryer|курьер|yetkaz/i },
  { q: "dostavka", expect: /kuryer|курьер|yetkaz/i },
  { q: "IT", expect: /dastur|developer|разработчик|программист|tester|qa|admin|dizayn|designer|ma'lumot|data|analitik|support|devops|\bit\b|ux|ui/i },
  { q: "IT sohasida ish kerak", expect: /./ },
  { q: "menejer", expect: /menejer/i },
  { q: "администратор", expect: /administrator/i },
  { q: "operator", expect: /operator/i },
];

const anonCats = () => createClient(env.url, env.anon, { auth: { persistSession: false } }).from("categories").select("id, slug, name_uz");

describe("search bench", () => {
  it("runs", { timeout: 300_000 }, async () => {
    const { resolveFindQuery, findJobs, findJobsByText, findJobsInCategory, getNodeInfo } = await import("@/features/find/queries");
    const { familyOf } = await import("@/features/find/families");
    const cats = (await anonCats()).data ?? [];
    const { textKeywords } = await import("@/features/find/ai-keywords");
    const { EMPTY_FIND } = await import("@/features/find/params");
    const anon = createClient(env.url, env.anon, { auth: { persistSession: false } });
    const out: unknown[] = [];
    for (const c of CASES) {
      const t0 = performance.now();
      const r = await resolveFindQuery(c.q);
      const t1 = performance.now();
      const node = r.nodeId ? await getNodeInfo(r.nodeId) : null;
      const nodeName = node ? node.trail.map((x) => x.name_uz).join(" › ") : null;
      const words = node ? [] : textKeywords(c.q, [], 3);
      const params = { ...EMPTY_FIND, mode: "jobs" as const, p: r.nodeId, page: 1 };
      const place = { regionId: null, districtId: null, remote: false };
      let titles: string[] = [];
      let total = 0;
      let via = "node";
      const t2 = performance.now();
      const fam = familyOf(c.q);
      const famCat = fam ? cats.find((x) => x.slug === fam) : undefined;
      if (famCat) {
        via = `category:${fam}`;
        const res = await findJobsInCategory(params, place, famCat.id, 10);
        if (res.ok) {
          titles = res.items.map((x) => x.title);
          total = res.total;
        }
      } else if (node || words.length === 0) {
        const res = await findJobs(params, place, 10, anon);
        if (res.ok) {
          titles = res.items.map((x) => x.title);
          total = res.total;
        }
      } else {
        via = `text:${words.join("|")}`;
        for (const w of words) {
          const res = await findJobsByText({ ...params, q: w }, place, 10);
          if (res.ok && res.total > 0) {
            titles = res.items.map((x) => x.title);
            total = res.total;
            break;
          }
        }
      }
      const t3 = performance.now();
      const relevant = c.expect ? titles.filter((x) => c.expect!.test(x) || (nodeName && c.expect!.test(nodeName))).length : null;
      const okNode = c.expect ? (!!nodeName && c.expect.test(nodeName)) || (via.startsWith("category") && titles.length > 0 && titles.filter((x) => c.expect!.test(x)).length >= Math.ceil(titles.length * 0.8)) : c.generic ? !node && via === "node" : null;
      out.push({ q: c.q, node: nodeName, via, total, top: titles.slice(0, 5), relevant, okNode, resolveMs: Math.round(t1 - t0), findMs: Math.round(t3 - t2) });
    }
    writeFileSync("e2e/.stack/search-bench.json", JSON.stringify(out, null, 1));
    const rows = out as Array<{ q: string; okNode: boolean | null; resolveMs: number; findMs: number }>;
    const judged = rows.filter((r) => r.okNode !== null);
    const ok = judged.filter((r) => r.okNode).length;
    const ms = rows.map((r) => r.resolveMs + r.findMs).sort((a, b) => a - b);
    const p95 = ms[Math.floor(ms.length * 0.95)]!;
    console.log(`search-bench: ${ok}/${judged.length} to'g'ri, p50 ${ms[Math.floor(ms.length / 2)]} ms, p95 ${p95} ms; xato: ${judged.filter((r) => !r.okNode).map((r) => r.q).join(", ") || "yo'q"}`);
    expect(ok / judged.length).toBeGreaterThanOrEqual(0.9);
    expect(p95).toBeLessThan(500);
  });
});
