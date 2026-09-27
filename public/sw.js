/* Worklyn service worker — faqat ilova qobig'i va oflayn sahifa.
 * Ma'lumotlar (Supabase, /api, sahifa HTML) keshlanmaydi: har doim yangi, maxfiy ma'lumot qurilmada qolmaydi. */
const VERSION = "worklyn-v1";
const PRECACHE = ["/offline.html", "/icons/icon-192.png", "/icons/icon-512.png", "/icon.svg", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Sahifalar: tarmoq; aloqa bo'lmasa — oflayn sahifa
  if (req.mode === "navigate") {
    event.respondWith(fetch(req).catch(() => caches.match("/offline.html")));
    return;
  }
  // Next.js statik fayllari (hash'li, o'zgarmas): kesh-birinchi
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(VERSION).then((c) => c.put(req, copy));
            }
            return res;
          }),
      ),
    );
  }
});
