#!/usr/bin/env node
/**
 * Prod bazaga hali qo'llanmagan migratsiyalarni BITTA faylga yig'adi: supabase/prod/pending.sql
 *
 * Nega: prod bazani faqat ega yangilaydi (Supabase → SQL Editor). Sakkizta faylni birma-bir qo'yish o'rniga — bitta fayl,
 * bitta "Run". Fayl bitta tranzaksiyada ishlaydi (xato bo'lsa hech narsa o'zgarmaydi) va takror ishga tushirish xavfsiz
 * (har migratsiya "if not exists" / "create or replace" bilan yozilgan — scripts/prod-pending-test.sh shuni tekshiradi).
 *
 *   node scripts/gen-prod-pending.mjs           — faylni qayta yaratadi
 *   node scripts/gen-prod-pending.mjs --check   — fayl eskirgan bo'lsa 1 bilan chiqadi (CI / Vitest)
 *
 * APPLIED_UNTIL — prod bazada aniq bor oxirgi migratsiya. Ega pending.sql ni qo'llagach shu raqam ko'tariladi.
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const APPLIED_UNTIL = 68;

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const MIGRATIONS = join(root, "supabase/migrations");
export const OUT = join(root, "supabase/prod/pending.sql");
const CHECK = join(root, "scripts/prod-migration-check.sql");

export function pendingFiles() {
  return readdirSync(MIGRATIONS)
    .filter((f) => /^\d{4}_.+\.sql$/.test(f) && Number(f.slice(0, 4)) > APPLIED_UNTIL)
    .sort();
}

/** scripts/prod-migration-check.sql dagi birinchi so'rov (holat jadvali) — fayl oxirida natija sifatida chiqadi */
function statusQuery() {
  const sql = readFileSync(CHECK, "utf8");
  const from = sql.indexOf("select m.migration");
  const end = sql.indexOf("order by m.migration;", from);
  if (from < 0 || end < 0) throw new Error("prod-migration-check.sql: holat so'rovi topilmadi");
  return sql.slice(from, end + "order by m.migration;".length);
}

export function build() {
  const files = pendingFiles();
  const first = files[0]?.slice(0, 4) ?? "—";
  const last = files.at(-1)?.slice(0, 4) ?? "—";
  const parts = [
    `-- ISH TOPDIM · prod bazani yangilash: ${first}…${last} migratsiyalari BITTA faylda (${files.length} ta).`,
    "-- BU FAYL AVTOMATIK YARATILADI (scripts/gen-prod-pending.mjs) — qo'lda tahrirlamang.",
    "--",
    "-- Qanday qo'llanadi (ega):",
    "--   1) Supabase → loyiha → Database → Backups: bugungi zaxira nusxa borligini ko'ring.",
    "--   2) Shu faylni to'liq nusxalang (GitHub'da \"Raw\" → Ctrl+A → Ctrl+C).",
    "--   3) Supabase → SQL Editor → New query → joylang → Run.",
    "--   4) Pastda jadval chiqadi: har qatorda \"bor\" bo'lishi kerak. Xato chiqsa — matnini yuboring (hech narsa o'zgarmagan bo'ladi).",
    "--",
    "-- Xavfsizlik: hammasi bitta tranzaksiyada (xato bo'lsa to'liq bekor qilinadi). Takror ishga tushirish zarar qilmaydi:",
    "-- allaqachon bor narsalar qayta yaratilmaydi, ma'lumot o'chirilmaydi.",
    "",
    "begin;",
    "",
  ];
  for (const f of files) {
    parts.push(`-- ═══════════════ ${f} ═══════════════`, readFileSync(join(MIGRATIONS, f), "utf8").trimEnd(), "");
  }
  parts.push("commit;", "", "-- Natija: har migratsiya bo'yicha holat (hammasi \"bor\" bo'lishi kerak)", statusQuery(), "");
  return parts.join("\n");
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const next = build();
  if (process.argv.includes("--check")) {
    const cur = existsSync(OUT) ? readFileSync(OUT, "utf8") : "";
    if (cur !== next) {
      console.error("supabase/prod/pending.sql eskirgan — qayta yarating: node scripts/gen-prod-pending.mjs");
      process.exit(1);
    }
    console.log(`pending.sql dolzarb (${pendingFiles().length} ta migratsiya)`);
  } else {
    mkdirSync(dirname(OUT), { recursive: true });
    writeFileSync(OUT, next);
    console.log(`yozildi: supabase/prod/pending.sql — ${pendingFiles().join(", ")}`);
  }
}
