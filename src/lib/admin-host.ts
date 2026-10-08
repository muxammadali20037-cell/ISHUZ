/**
 * Alohida admin host (ADMIN_HOST, masalan admin.<domen>) yo'naltirishi — sof funksiya (testlanadi).
 *  - admin hostda: /admin/*, kirish (/auth) va /api, /_next o'tadi; qolgan yo'llar /admin ostiga ko'chiriladi
 *    ("/" → "/admin", "/moderation" → "/admin/moderation"). Ommaviy sahifalar admin hostda ochilmaydi.
 *  - asosiy hostda: ADMIN_HOST sozlangan bo'lsa /admin — 404 (panel ommaviy saytda ko'rinmaydi).
 *  - ADMIN_HOST sozlanmagan (lokal ishlab chiqish): /admin asosiy hostda ishlaydi.
 */
export type AdminHostRoute = { kind: "pass"; admin: boolean } | { kind: "rewrite"; path: string } | { kind: "not_found" };

const PASS_ON_ADMIN = [/^\/admin(\/|$)/, /^\/auth(\/|$)/, /^\/api\//, /^\/_next\//, /^\/blocked$/];

export function isAdminPath(pathname: string): boolean {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

export function sameHost(host: string, adminHost: string): boolean {
  const h = host.trim().toLowerCase();
  const a = adminHost.trim().toLowerCase();
  if (!h || !a) return false;
  return h === a || (!a.includes(":") && h.split(":")[0] === a);
}

export function adminHostRoute(host: string, pathname: string, adminHost: string | undefined | null): AdminHostRoute {
  if (!adminHost) return { kind: "pass", admin: isAdminPath(pathname) };
  if (sameHost(host, adminHost)) {
    if (PASS_ON_ADMIN.some((r) => r.test(pathname))) return { kind: "pass", admin: true };
    return { kind: "rewrite", path: pathname === "/" ? "/admin" : `/admin${pathname}` };
  }
  return isAdminPath(pathname) ? { kind: "not_found" } : { kind: "pass", admin: false };
}
