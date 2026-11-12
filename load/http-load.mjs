#!/usr/bin/env node
/**
 * HTTP yuklama testi (autocannon): bir vaqtda N ta ulanish asosiy sahifalarga so'rov yuboradi.
 *
 *   node load/http-load.mjs                       # http://localhost:3300, 50 → 200 → 500 ulanish, har biri 15 s
 *   BASE=http://localhost:3300 CONN=50,200 DUR=10 node load/http-load.mjs
 *   SLUG=load-4 node load/http-load.mjs           # vakansiya sahifasi uchun slug (stendda mavjud bo'lishi shart)
 *   OUT=load/results/2026-11-12.json node load/http-load.mjs
 *
 * FAQAT lokal stend yoki egasi ruxsat bergan staging uchun. Prod'ga (ishuz.vercel.app) yo'naltirish taqiqlangan —
 * bu pul (Vercel/Supabase) va firewall bloklanishiga olib keladi; skript bunday manzilda ishga tushmaydi.
 *
 * Nimani o'lchaydi: so'rov/s, kechikish (p50 / p97.5 / p99), 2xx bo'lmagan javoblar, xatolar va timeout'lar.
 * Nimani o'lchamaydi: Vercel'dagi gorizontal masshtab (har bir funksiya nusxasi alohida), CDN keshi, real tarmoq.
 */
import autocannon from "autocannon";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const BASE = (process.env.BASE ?? "http://localhost:3300").replace(/\/$/, "");
if (!/^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?$/.test(BASE) && process.env.ALLOW_REMOTE !== "1") {
  console.error(`Faqat lokal manzil (${BASE} emas). Staging uchun egasi ruxsati bilan ALLOW_REMOTE=1.`);
  process.exit(2);
}
if (/vercel\.app|ishuz\.uz|ishtopdim/i.test(BASE)) {
  console.error("Prod manziliga yuklama testi yuborilmaydi.");
  process.exit(2);
}

const CONNECTIONS = (process.env.CONN ?? "50,200,500").split(",").map((n) => Number(n)).filter((n) => n > 0);
const DURATION = Number(process.env.DUR ?? 15);
const SLUG = process.env.SLUG ?? "load-4";
const GUEST = "ib_consent=1; ib_intro=1; ib_mode=worker";

/** Sahifalar: mehmon (cookie'siz, faqat tanishuv o'tilgan) ko'rinishi — eng ko'p so'raladigan yo'llar */
const SCENARIOS = [
  { name: "Bosh sahifa (ish izlovchi, mehmon)", path: "/", cookie: GUEST },
  { name: "/jobs (ro'yxat)", path: "/jobs", cookie: GUEST },
  { name: "/jobs?q=shifokor (matnli qidiruv)", path: "/jobs?q=shifokor", cookie: GUEST },
  { name: "/jobs?q=sotuvchi&region=tashkent_city", path: "/jobs?q=sotuvchi&region=tashkent_city", cookie: GUEST },
  { name: `/jobs/${SLUG} (vakansiya sahifasi)`, path: `/jobs/${SLUG}`, cookie: GUEST },
  { name: "/api/professions/search?q=shif", path: "/api/professions/search?q=shif", cookie: "" },
  { name: "/kasblar", path: "/kasblar", cookie: GUEST },
  { name: "/api/health", path: "/api/health", cookie: "" },
];

function run(url, connections, cookie) {
  return new Promise((resolve, reject) => {
    const inst = autocannon(
      {
        url,
        connections,
        duration: DURATION,
        pipelining: 1,
        timeout: 30,
        headers: { cookie, "accept-language": "uz", "user-agent": "ishuz-http-load/1" },
      },
      (err, res) => (err ? reject(err) : resolve(res)),
    );
    autocannon.track(inst, { renderProgressBar: false, renderResultsTable: false, renderLatencyTable: false });
  });
}

function fmt(n) {
  return n >= 1000 ? `${(n / 1000).toFixed(1)} s` : `${Math.round(n)} ms`;
}

const results = [];
console.log(`Yuklama testi → ${BASE} · ulanishlar: ${CONNECTIONS.join(", ")} · har biri ${DURATION} s\n`);
for (const s of SCENARIOS) {
  // Avval bitta isitish so'rovi — sovuq kesh va ulanish natijaga aralashmasin
  await fetch(BASE + s.path, { headers: { cookie: s.cookie } }).catch(() => {});
  for (const c of CONNECTIONS) {
    const r = await run(BASE + s.path, c, s.cookie);
    const row = {
      scenario: s.name,
      path: s.path,
      connections: c,
      rps: Math.round(r.requests.average),
      p50: r.latency.p50,
      p97_5: r.latency.p97_5,
      p99: r.latency.p99,
      max: r.latency.max,
      requests: r.requests.total,
      non2xx: r.non2xx,
      errors: r.errors,
      timeouts: r.timeouts,
    };
    results.push(row);
    const bad = row.non2xx + row.errors + row.timeouts;
    console.log(
      `${s.name.padEnd(44)} ${String(c).padStart(4)} ul. │ ${String(row.rps).padStart(5)} so'rov/s │ p50 ${fmt(row.p50).padStart(7)} │ p97.5 ${fmt(row.p97_5).padStart(7)} │ p99 ${fmt(row.p99).padStart(7)} │ ${bad ? `⚠ ${row.non2xx} non-2xx, ${row.errors} xato, ${row.timeouts} timeout` : "xato yo'q"}`,
    );
  }
}

if (process.env.OUT) {
  mkdirSync(dirname(process.env.OUT), { recursive: true });
  writeFileSync(process.env.OUT, JSON.stringify({ base: BASE, at: new Date().toISOString(), duration: DURATION, results }, null, 2));
  console.log(`\nNatija: ${process.env.OUT}`);
}
