#!/usr/bin/env node
// Buzmaydigan xavfsizlik tekshiruvi (staging yoki lokal): sarlavhalar, CSRF, soxta initData, webhook kaliti, admin yo'li.
// Yuk testi EMAS — har tekshiruv 1 ta so'rov. Foydalanish:
//   node scripts/security/probe.mjs https://staging.example.uz [https://admin.staging.example.uz]
// Natija: har qator PASS/FAIL, oxirida umumiy son; FAIL bo'lsa chiqish kodi 1.
const [base, adminBase] = process.argv.slice(2);
if (!base) {
  console.error("foydalanish: node scripts/security/probe.mjs <app-url> [admin-url]");
  process.exit(2);
}
const results = [];
const check = (ok, name, extra = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"} - ${name}${extra ? ` :: ${extra}` : ""}`);
};
const https = base.startsWith("https://");
const origin = new URL(base).origin;
const post = (path, body, headers = {}) =>
  fetch(`${base}${path}`, { method: "POST", redirect: "manual", headers: { "content-type": "application/json", origin, ...headers }, body: typeof body === "string" ? body : JSON.stringify(body) });

// sarlavhalar
const home = await fetch(`${base}/`, { redirect: "manual" });
const csp = home.headers.get("content-security-policy") ?? "";
check(/object-src 'none'/.test(csp) && /base-uri 'self'/.test(csp) && /form-action 'self'/.test(csp), "CSP: object-src/base-uri/form-action");
check(/frame-ancestors /.test(csp) && !/frame-ancestors [^;]*\*/.test(csp), "CSP: frame-ancestors ro'yxat bilan (wildcard yo'q)");
check(home.headers.get("x-content-type-options") === "nosniff", "X-Content-Type-Options: nosniff");
if (https) check(/max-age=\d{7,}/.test(home.headers.get("strict-transport-security") ?? ""), "HSTS (≥ 4 oy)");
check(!home.headers.get("x-powered-by"), "X-Powered-By yo'q");

// login CSRF va kirish
const evil = await post("/api/auth/telegram", { initData: "x".repeat(20) }, { origin: "https://evil.example" });
check(evil.status === 403, "begona Origin'dan kirish — 403", String(evil.status));
const form = await fetch(`${base}/api/auth/telegram`, { method: "POST", headers: { "content-type": "text/plain", origin }, body: '{"initData":"xxxxxxxxxxxx"}' });
check(form.status === 415, "text/plain forma — 415", String(form.status));
const fake = await post("/api/auth/telegram", { initData: "auth_date=1700000000&user=%7B%22id%22%3A1%7D&hash=" + "0".repeat(64) });
check(fake.status === 401, "soxta initData — 401", String(fake.status));
const otpEvil = await post("/api/auth/phone-code/verify", { phone: "+998900000000", code: "000000" }, { origin: "https://evil.example" });
check(otpEvil.status === 403, "begona Origin'dan kod tekshiruvi — 403", String(otpEvil.status));

// webhook va cron kalitsiz
const hook = await fetch(`${base}/api/telegram/webhook`, { method: "POST", headers: { "content-type": "application/json", "X-Telegram-Bot-Api-Secret-Token": "wrong" }, body: "{}" });
check(hook.status === 401, "Telegram webhook noto'g'ri kalit — 401", String(hook.status));
const cron = await fetch(`${base}/api/cron/tick`, { redirect: "manual" });
check(cron.status === 401 || cron.status === 403, "cron kalitsiz — rad", String(cron.status));

// ochiq yo'naltirish
const redir = await fetch(`${base}/auth?next=${encodeURIComponent("//evil.example/x")}`, { redirect: "manual" });
const loc = redir.headers.get("location") ?? "";
check(!/evil\.example/.test(loc), "next= ochiq yo'naltirish yo'q", loc || String(redir.status));

// admin
if (adminBase) {
  const a = await fetch(`${adminBase}/`, { redirect: "manual" });
  check(/frame-ancestors 'none'/.test(a.headers.get("content-security-policy") ?? "") && a.headers.get("x-frame-options") === "DENY", "admin: ramkaga olinmaydi");
  const onMain = await fetch(`${base}/admin`, { redirect: "manual" });
  check(onMain.status === 404, "asosiy hostda /admin — 404", String(onMain.status));
}

const failed = results.filter((x) => !x).length;
console.log(`\n${results.length - failed}/${results.length} PASS`);
process.exit(failed ? 1 : 0);
