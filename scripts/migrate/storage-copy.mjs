#!/usr/bin/env node
/**
 * Bazani Frankfurtga ko'chirish (4-bosqich): Storage fayllarini eski loyihadan yangisiga nusxalash.
 * docs/FRANKFURT_MIGRATION.md §4. Faqat GitHub Actions'da (region-migrate.yml) yoki egasining kompyuterida ishlaydi.
 *
 * Kerak (muhit o'zgaruvchilari; qiymatlar hech qachon chiqarilmaydi):
 *   OLD_SUPABASE_URL, OLD_SUPABASE_SERVICE_KEY — eski loyiha (Mumbay)
 *   NEW_SUPABASE_URL, NEW_SUPABASE_SERVICE_KEY — yangi loyiha (Frankfurt)
 *
 * Xavfsiz va qayta ishga tushirsa bo'ladi: bucket'lar bir xil sozlama bilan yaratiladi (bor bo'lsa — sozlama
 * yangilanadi), fayl yangisida xuddi shu hajmda bo'lsa — o'tkazib yuboriladi. Eski loyihada hech narsa o'zgarmaydi.
 * Natija: har bucket bo'yicha fayl soni (eski / yangi) — fayl nomlari va mazmuni chiqarilmaydi.
 * Chiqish kodi: hammasi mos bo'lsa 0, aks holda 1.
 */
import { createClient } from "@supabase/supabase-js";

const need = ["OLD_SUPABASE_URL", "OLD_SUPABASE_SERVICE_KEY", "NEW_SUPABASE_URL", "NEW_SUPABASE_SERVICE_KEY"];
const missing = need.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`Yetishmayapti: ${missing.join(", ")}`);
  process.exit(2);
}
if (process.env.OLD_SUPABASE_URL === process.env.NEW_SUPABASE_URL) {
  console.error("Eski va yangi loyiha bir xil — to'xtatildi");
  process.exit(2);
}

const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const oldDb = createClient(process.env.OLD_SUPABASE_URL, process.env.OLD_SUPABASE_SERVICE_KEY, opts);
const newDb = createClient(process.env.NEW_SUPABASE_URL, process.env.NEW_SUPABASE_SERVICE_KEY, opts);

/** papkalar ichigacha barcha fayllar: { path, size, mimetype, cacheControl } */
async function listAll(db, bucket, prefix = "") {
  const out = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await db.storage.from(bucket).list(prefix, { limit: 1000, offset, sortBy: { column: "name", order: "asc" } });
    if (error) throw new Error(`${bucket}: ro'yxat — ${error.message}`);
    for (const item of data ?? []) {
      const path = prefix ? `${prefix}/${item.name}` : item.name;
      if (!item.id && !item.metadata) out.push(...(await listAll(db, bucket, path)));
      else if (item.name !== ".emptyFolderPlaceholder") out.push({ path, size: Number(item.metadata?.size ?? -1), mimetype: item.metadata?.mimetype, cacheControl: item.metadata?.cacheControl });
    }
    if (!data || data.length < 1000) break;
  }
  return out;
}

async function ensureBucket(b) {
  const settings = { public: b.public, fileSizeLimit: b.file_size_limit ?? undefined, allowedMimeTypes: b.allowed_mime_types ?? undefined };
  const { data } = await newDb.storage.getBucket(b.id);
  const { error } = data ? await newDb.storage.updateBucket(b.id, settings) : await newDb.storage.createBucket(b.id, settings);
  if (error) throw new Error(`${b.id}: bucket — ${error.message}`);
}

async function copyOne(bucket, f, existing) {
  if (existing.get(f.path) === f.size && f.size >= 0) return "skip";
  const { data: blob, error: dErr } = await oldDb.storage.from(bucket).download(f.path);
  if (dErr || !blob) throw new Error(`yuklab olish: ${dErr?.message ?? "bo'sh"}`);
  const { error: uErr } = await newDb.storage
    .from(bucket)
    .upload(f.path, blob, { upsert: true, contentType: f.mimetype || blob.type || undefined, cacheControl: f.cacheControl?.replace(/^max-age=/, "") || undefined });
  if (uErr) throw new Error(`yuklash: ${uErr.message}`);
  return "copied";
}

const { data: buckets, error } = await oldDb.storage.listBuckets();
if (error) {
  console.error(`Eski loyiha bucket'lari: ${error.message}`);
  process.exit(1);
}
let ok = true;
const rows = [];
for (const b of buckets) {
  await ensureBucket(b);
  const files = await listAll(oldDb, b.id);
  const existing = new Map((await listAll(newDb, b.id)).map((f) => [f.path, f.size]));
  let copied = 0;
  let skipped = 0;
  let failed = 0;
  for (let i = 0; i < files.length; i += 8) {
    const batch = files.slice(i, i + 8);
    const results = await Promise.allSettled(batch.map((f) => copyOne(b.id, f, existing)));
    for (const r of results) {
      if (r.status === "rejected") failed++;
      else if (r.value === "copied") copied++;
      else skipped++;
    }
  }
  const after = (await listAll(newDb, b.id)).length;
  const match = after >= files.length && failed === 0;
  if (!match) ok = false;
  rows.push({ bucket: b.id, public: b.public, old: files.length, new: after, copied, skipped, failed, ok: match });
}
console.table(rows);
console.log(ok ? "STORAGE: hammasi mos" : "STORAGE: farq bor — qayta ishga tushiring (nusxalangan fayllar qayta yuklanmaydi)");
process.exit(ok ? 0 : 1);
