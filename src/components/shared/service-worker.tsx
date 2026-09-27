"use client";

import { useEffect } from "react";

/** PWA: /sw.js ni ro'yxatdan o'tkazadi (faqat production — dev'da eski keshlar chalg'itmasin) */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    const register = () => navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((e) => console.warn("[sw]", e));
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);
  return null;
}
