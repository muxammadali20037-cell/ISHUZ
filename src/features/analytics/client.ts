"use client";

/** Voronka hodisasi (shaxsiy ma'lumotsiz). sendBeacon — sahifadan chiqib ketayotganda ham yetib boradi. */
export function track(name: string, props?: Record<string, string | number | boolean>): void {
  if (typeof window === "undefined") return;
  try {
    const body = JSON.stringify({ name, props: props ?? {} });
    if (navigator.sendBeacon?.(`/api/e`, new Blob([body], { type: "application/json" }))) return;
    void fetch("/api/e", { method: "POST", body, headers: { "content-type": "application/json" }, keepalive: true }).catch(() => undefined);
  } catch {
    // statistika hech qachon asosiy ishni buzmaydi
  }
}
