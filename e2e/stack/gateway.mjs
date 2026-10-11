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

    const st = /^\/storage\/v1\/object\/(public\/)?([^/?]+)\/([^?]+)/.exec(url);
    if (st) {
      const file = path.join(STORAGE_DIR, st[2], decodeURIComponent(st[3]));
      if (!file.startsWith(STORAGE_DIR + path.sep)) return json(res, 400, { message: "bad path" });
      if (!st[1] && (req.method === "POST" || req.method === "PUT")) {
        const c = verify((req.headers.authorization || "").replace(/^Bearer /, ""));
        if (!c) return json(res, 401, { message: "unauthorized" });
        const chunks = [];
        req.on("data", (d) => chunks.push(d));
        req.on("end", () => {
          fs.mkdirSync(path.dirname(file), { recursive: true });
          fs.writeFileSync(file, fileFromMultipart(Buffer.concat(chunks), req.headers["content-type"]));
          json(res, 200, { Key: `${st[2]}/${st[3]}`, Id: crypto.randomUUID() });
        });
        return;
      }
      if (req.method === "GET" && fs.existsSync(file)) {
        const ext = path.extname(file).toLowerCase();
        const type = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".pdf": "application/pdf" }[ext] || "application/octet-stream";
        res.writeHead(200, { "content-type": type, "x-content-type-options": "nosniff" });
        return res.end(fs.readFileSync(file));
      }
      return json(res, 404, { message: "not found" });
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
  })
  .listen(PORT, "127.0.0.1", () => console.log(`e2e gateway :${PORT} → postgrest :${PGRST_PORT}`));
