// E2E uchun lokal Supabase shlyuzi: PostgREST'ga proksi + Auth (/auth/v1/user) va Storage'ning kichik emulyatsiyasi.
// Faqat sinov muhiti: JWT kaliti har ishga tushirishda tasodifiy (up.sh yaratadi), haqiqiy Supabase kalitlari ishlatilmaydi.
//
// Env: E2E_JWT_SECRET (majburiy), GATEWAY_PORT (54331), PGRST_PORT (3401), STORAGE_DIR (fayllar)
import fs from "node:fs";
import http from "node:http";
import crypto from "node:crypto";
import path from "node:path";

const SECRET = process.env.E2E_JWT_SECRET;
if (!SECRET || SECRET.length < 32) {
  console.error("E2E_JWT_SECRET kerak (kamida 32 belgi)");
  process.exit(1);
}
const PORT = Number(process.env.GATEWAY_PORT || 54331);
const PGRST_PORT = Number(process.env.PGRST_PORT || 3401);
const STORAGE_DIR = process.env.STORAGE_DIR || path.resolve("e2e/.stack/storage");
// o'lchov uchun: har so'rovga sun'iy kechikish (Vercel → Supabase tarmog'i) va so'rovlar jurnali (e2e/perf/steps.mjs)
const LATENCY_MS = Number(process.env.E2E_DB_LATENCY_MS || 0);
const LOG_REQUESTS = process.env.E2E_GATEWAY_LOG === "1";

const PUBLIC_BUCKETS = new Set(["avatars", "company-logos", "profession-images", "vacancy-photos"]);
const RAW_PHOTO = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp)$/;
const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const RAW_MEDIA = new RegExp(`^(avatar|logo)/(${UUID})/${UUID}\\.(jpg|png|webp)$`);
const LEGACY_LOGO = new RegExp(`^(${UUID})/logo\\.(jpg|png|webp)$`);

/**
 * Mijoz yozuvi uchun Storage RLS siyosatlarining (0049, 0058, 0059) qisqa nusxasi:
 * null — ruxsat; matn — rad sababi; { company } — kompaniya adminligi tekshiriladi (is_company_admin, foydalanuvchi nomidan).
 */
function clientWriteDenied(bucket, name, sub) {
  if (bucket === "media-uploads") {
    const m = RAW_MEDIA.exec(name);
    if (!m) return "raw_name";
    if (m[1] === "avatar") return m[2] === sub ? null : "own_folder";
    return { company: m[2] };
  }
  if (bucket === "company-logos") {
    const m = LEGACY_LOGO.exec(name);
    return m ? { company: m[1] } : "legacy_name_only";
  }
  if (!sub || name.split("/")[0] !== sub) return "own_folder";
  if (bucket === "avatars" && !/^[^/]+\/avatar\.(jpg|png|webp)$/.test(name)) return "legacy_name_only";
  if (bucket === "vacancy-uploads" && !RAW_PHOTO.test(name)) return "raw_name";
  if (bucket === "vacancy-photos" && /\/v-[^/]*$/.test(name)) return "verified_server_only";
  return null;
}

/** public.is_company_admin — PostgREST orqali, so'rov egasining tokeni bilan (RLS siyosatidagi kabi) */
function isCompanyAdmin(companyId, authorization) {
  return new Promise((resolve) => {
    const body = JSON.stringify({ p_company_id: companyId });
    const r = http.request(
      { host: "127.0.0.1", port: PGRST_PORT, path: "/rpc/is_company_admin", method: "POST", headers: { "content-type": "application/json", "content-length": Buffer.byteLength(body), authorization } },
      (resp) => {
        let d = "";
        resp.on("data", (c) => (d += c));
        resp.on("end", () => resolve(d.trim() === "true"));
      },
    );
    r.on("error", () => resolve(false));
    r.end(body);
  });
}

/** HS256 tekshiruvi: imzosi noto'g'ri yoki muddati o'tgan token — foydalanuvchi yo'q */
function verify(token) {
  const [h, p, s] = (token || "").split(".");
  if (!h || !p || !s) return null;
  const expected = crypto.createHmac("sha256", SECRET).update(`${h}.${p}`).digest("base64url");
  if (s.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(s), Buffer.from(expected))) return null;
  try {
    const claims = JSON.parse(Buffer.from(p, "base64url").toString());
    if (claims.exp && claims.exp < Date.now() / 1000) return null;
    return claims;
  } catch {
    return null;
  }
}

function json(res, code, obj) {
  res.writeHead(code, { "content-type": "application/json" });
  res.end(JSON.stringify(obj));
}

/** multipart/form-data dan fayl qismi (haqiqiy Storage kabi faqat fayl baytlari saqlanadi) */
function fileFromMultipart(body, contentType) {
  const m = /boundary=(?:"([^"]+)"|([^;]+))/.exec(contentType || "");
  if (!contentType?.startsWith("multipart/form-data") || !m) return body;
  const sep = Buffer.from(`--${m[1] || m[2]}`);
  let i = body.indexOf(sep);
  while (i !== -1) {
    const n = body.indexOf(sep, i + sep.length);
    if (n === -1) break;
    const part = body.subarray(i + sep.length + 2, n - 2);
    const headEnd = part.indexOf("\r\n\r\n");
    if (headEnd !== -1 && /filename=/.test(part.subarray(0, headEnd).toString("latin1"))) return part.subarray(headEnd + 4);
    i = n;
  }
  return body;
}

http
  .createServer((req, res) => {
    if (LOG_REQUESTS) console.log(`${Date.now()} ${req.method} ${(req.url || "").split("?")[0]}`);
    if (LATENCY_MS > 0) setTimeout(() => handle(req, res), LATENCY_MS);
    else handle(req, res);
  })
  .listen(PORT, "127.0.0.1", () => console.log(`e2e gateway :${PORT} → postgrest :${PGRST_PORT}${LATENCY_MS ? ` (+${LATENCY_MS} ms)` : ""}`));

async function handle(req, res) {
  res.setHeader("access-control-allow-origin", req.headers.origin || "*");
  res.setHeader("access-control-allow-credentials", "true");
  res.setHeader("access-control-allow-headers", req.headers["access-control-request-headers"] || "*");
  res.setHeader("access-control-allow-methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }
  const url = req.url || "/";

  if (url.startsWith("/auth/v1/.well-known/jwks.json")) return json(res, 200, { keys: [] });
  if (url.startsWith("/auth/v1/logout")) {
    res.writeHead(204);
    return res.end();
  }
  if (url.startsWith("/auth/v1/user")) {
    const c = verify((req.headers.authorization || "").replace(/^Bearer /, ""));
    if (!c?.sub) return json(res, 401, { code: 401, msg: "invalid JWT" });
    return json(res, 200, {
      id: c.sub,
      aud: "authenticated",
      role: "authenticated",
      email: c.email,
      app_metadata: {},
      user_metadata: {},
      factors: [],
      created_at: new Date().toISOString(),
    });
  }

  // DELETE /storage/v1/object/<bucket> {prefixes: [...]} — faqat service role (Supabase'da mijoz uchun siyosat hal qiladi)
  const rm = /^\/storage\/v1\/object\/([^/?]+)\/?$/.exec(url);
  if (rm && req.method === "DELETE") {
    const c = verify((req.headers.authorization || "").replace(/^Bearer /, ""));
    if (c?.role !== "service_role") return json(res, 403, { statusCode: "403", error: "Unauthorized", message: "forbidden" });
    const chunks = [];
    req.on("data", (d) => chunks.push(d));
    req.on("end", () => {
      let prefixes = [];
      try {
        prefixes = JSON.parse(Buffer.concat(chunks).toString() || "{}").prefixes || [];
      } catch {
        return json(res, 400, { message: "bad json" });
      }
      const gone = [];
      for (const name of prefixes) {
        const f = path.join(STORAGE_DIR, rm[1], name);
        if (f.startsWith(STORAGE_DIR + path.sep) && fs.existsSync(f)) {
          fs.unlinkSync(f);
          gone.push({ name, bucket_id: rm[1] });
        }
      }
      json(res, 200, gone);
    });
    return;
  }

  // POST /storage/v1/object/list/<bucket> {prefix} — papka ichidagi fayllar (service role; mijoz — faqat o'z papkasi)
  const ls = /^\/storage\/v1\/object\/list\/([^/?]+)/.exec(url);
  if (ls && req.method === "POST") {
    const c = verify((req.headers.authorization || "").replace(/^Bearer /, ""));
    const chunks = [];
    req.on("data", (d) => chunks.push(d));
    req.on("end", () => {
      let prefix = "";
      try {
        prefix = String(JSON.parse(Buffer.concat(chunks).toString() || "{}").prefix || "").replace(/\/+$/, "");
      } catch {
        return json(res, 400, { message: "bad json" });
      }
      if (c?.role !== "service_role" && (!c?.sub || prefix.split("/")[0] !== c.sub)) return json(res, 200, []);
      const dir = path.join(STORAGE_DIR, ls[1], prefix);
      if (!dir.startsWith(path.join(STORAGE_DIR, ls[1])) || !fs.existsSync(dir)) return json(res, 200, []);
      const now = new Date().toISOString();
      json(res, 200, fs.readdirSync(dir).map((n) => ({ name: n, id: crypto.randomUUID(), created_at: now, updated_at: now, metadata: {} })));
    });
    return;
  }

  const st = /^\/storage\/v1\/object\/(public\/)?([^/?]+)\/([^?]+)/.exec(url);
  if (st) {
    const bucket = st[2];
    const name = decodeURIComponent(st[3]);
    const file = path.join(STORAGE_DIR, bucket, name);
    if (!file.startsWith(STORAGE_DIR + path.sep)) return json(res, 400, { message: "bad path" });
    const c = verify((req.headers.authorization || "").replace(/^Bearer /, ""));
    if (!st[1] && (req.method === "POST" || req.method === "PUT")) {
      if (!c) return json(res, 401, { message: "unauthorized" });
      if (c.role !== "service_role") {
        let denied = clientWriteDenied(bucket, name, c.sub);
        if (denied && typeof denied === "object") denied = (await isCompanyAdmin(denied.company, req.headers.authorization || "")) ? null : "company_admin";
        if (denied) return json(res, 403, { statusCode: "403", error: "Unauthorized", message: `new row violates row-level security policy (${denied})` });
        if (fs.existsSync(file) && req.headers["x-upsert"] !== "true") return json(res, 409, { statusCode: "409", error: "Duplicate", message: "The resource already exists" });
      }
      const chunks = [];
      req.on("data", (d) => chunks.push(d));
      req.on("end", () => {
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, fileFromMultipart(Buffer.concat(chunks), req.headers["content-type"]));
        json(res, 200, { Key: `${bucket}/${name}`, Id: crypto.randomUUID() });
      });
      return;
    }
    // ommaviy havola — faqat ommaviy bucket; yopiq bucket'dan o'qish — faqat service role
    const readable = PUBLIC_BUCKETS.has(bucket) || (!st[1] && c?.role === "service_role");
    if (req.method === "GET" && readable && fs.existsSync(file)) {
      const ext = path.extname(file).toLowerCase();
      const type = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".pdf": "application/pdf" }[ext] || "application/octet-stream";
      res.writeHead(200, { "content-type": type, "x-content-type-options": "nosniff" });
      return res.end(fs.readFileSync(file));
    }
    return json(res, 404, { statusCode: "404", error: "not_found", message: "Object not found" });
  }

  if (url.startsWith("/rest/v1")) {
    const target = url.replace(/^\/rest\/v1/, "") || "/";
    const up = http.request({ host: "127.0.0.1", port: PGRST_PORT, path: target, method: req.method, headers: { ...req.headers, host: `127.0.0.1:${PGRST_PORT}` } }, (r) => {
      res.writeHead(r.statusCode || 502, r.headers);
      r.pipe(res);
    });
    req.pipe(up);
    up.on("error", (e) => json(res, 502, { message: String(e) }));
    return;
  }
  return json(res, 404, {});
}
