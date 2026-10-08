"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { track } from "./client";

/**
 * Yengil voronka kuzatuvi: bosh sahifa ko'rildi; [data-track] bosildi (yo'nalish tanlash);
 * tel: havolasi bosildi (aloqa — bu ishga olish EMAS). Admin panelda ishlamaydi.
 */
export function AnalyticsListener() {
  const pathname = usePathname();
  useEffect(() => {
    if (pathname === "/") track("home_view");
  }, [pathname]);
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const el = e.target instanceof Element ? e.target : null;
      if (!el || window.location.pathname.startsWith("/admin")) return;
      const marked = el.closest<HTMLElement>("[data-track]");
      if (marked?.dataset.track) track(marked.dataset.track, marked.dataset.trackTo ? { to: marked.dataset.trackTo } : undefined);
      const tel = el.closest<HTMLAnchorElement>('a[href^="tel:"]');
      if (tel) track("contact_click", { page: window.location.pathname.split("/")[1] || "home" });
    };
    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, []);
  return null;
}
