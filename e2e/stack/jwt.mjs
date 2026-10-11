// E2E: sinov JWT va Supabase sessiya cookie'si (faqat lokal stend uchun; kalit up.sh yaratgan tasodifiy qiymat)
import crypto from "node:crypto";

const b64 = (o) => Buffer.from(typeof o === "string" ? o : JSON.stringify(o)).toString("base64url");

export function sign(payload, secret) {
  const h = b64({ alg: "HS256", typ: "JWT" });
  const p = b64(payload);
  return `${h}.${p}.${crypto.createHmac("sha256", secret).update(`${h}.${p}`).digest("base64url")}`;
}

const FAR = 4_102_444_800; // 2100-01-01

export function roleKey(role, secret) {
  return sign({ role, iss: "e2e", iat: Math.floor(Date.now() / 1000), exp: FAR }, secret);
}

/** @supabase/ssr formatidagi cookie (sb-<host>-auth-token) — foydalanuvchi "kirgan" holat */
export function sessionCookie(userId, secret) {
  const iat = Math.floor(Date.now() / 1000);
  const access = sign({ role: "authenticated", sub: userId, email: `${userId}@e2e.local`, aud: "authenticated", aal: "aal1", iat, exp: FAR }, secret);
  const session = {
    access_token: access,
    refresh_token: "e2e-refresh",
    token_type: "bearer",
    expires_in: FAR - iat,
    expires_at: FAR,
    user: { id: userId, aud: "authenticated", role: "authenticated", email: `${userId}@e2e.local`, app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() },
  };
  return { name: "sb-localhost-auth-token", value: `base64-${Buffer.from(JSON.stringify(session)).toString("base64")}` };
}

if (process.argv[2] === "role") console.log(roleKey(process.argv[3], process.env.E2E_JWT_SECRET));
