"use client";

import { Suspense, useEffect, useLayoutEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { BareSkeleton, PageSkeleton } from "./page-skeleton";
import { setPendingPath } from "./nav-pending";

/**
 * Havola bosilgan zahoti yangi ekran (ega, 2026-11-16: "tugma bosilgach keyingi oynaga o'tishi sekin — tepada ko'k chiziq
 * kutib turadi, umuman yoqmayapti"):
 *  - boshqa sahifaga — eski sahifa ko'rinib turmaydi: kontent o'rnida darhol yangi sahifaning skeleti (menyu va yuqori panel
 *    joyida qoladi), pastki menyuda bosilgan bo'lim darhol belgilanadi; server javobi kelishi bilan haqiqiy sahifa almashadi.
 *    Sahifa oldindan yuklangan bo'lsa (Next prefetch, loading.tsx) — o'sha zahoti ochiladi, bu qatlam umuman ko'rinmaydi;
 *  - o'sha sahifaning o'zida (filtr, sahifa raqami) — kontent qoladi, faqat ingichka chiziq (kechiksa).
 * Qatlam bosishni to'smaydi (pointer-events: none); 10 s da o'zi yo'qoladi (tarmoq uzilsa, o'tish bekor qilinsa).
 * loading.tsx'dan farqli: sahifaning HTTP holatiga (404, yo'naltirish) ta'sir qilmaydi.
 */

// menyusiz to'liq ekranlar (kirish, birinchi ochilish) — butun ekran skeleti
const BARE = ["/start", "/auth", "/dunyo", "/ai"];
const isBare = (p: string) => BARE.some((b) => p === b || p.startsWith(b + "/"));

interface Pending {
  from: string;
  to: string;
  same: boolean;
  n: number;
  /** kontent maydoni (sarlavha va pastki menyu orasi) — bosilgan paytdagi o'lcham */
  rect: { top: number; left: number; right: number; bottom: number };
}

function contentRect(): Pending["rect"] {
  const vw = window.innerWidth, vh = window.innerHeight;
  const header = document.querySelector("body header");
  const main = document.querySelector("main");
  const nav = document.querySelector("nav.bottom-nav");
  const hb = header ? header.getBoundingClientRect().bottom : 0;
  const mr = main ? main.getBoundingClientRect() : null;
  const nb = nav && getComputedStyle(nav).display !== "none" ? nav.getBoundingClientRect().top : vh;
  return { top: Math.max(0, Math.min(hb, vh)), left: Math.max(0, mr?.left ?? 0), right: Math.max(0, vw - (mr?.right ?? vw)), bottom: Math.max(0, vh - nb) };
}

function NavProgressBar() {
  const url = `${usePathname()}?${useSearchParams().toString()}`;
  const [pending, setPending] = useState<Pending | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    let hideTimer = 0, showTimer = 0;
    const clear = () => {
      window.clearTimeout(hideTimer);
      window.clearTimeout(showTimer);
      setPending(null);
      setShown(false);
      setPendingPath(null);
    };
    const onClick = (e: MouseEvent) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const target = e.target as Element | null;
      const a = target?.closest?.("a[href]") as HTMLAnchorElement | null;
      // data-no-progress — havola sahifani almashtirmaydi (masalan, tanishtiruv slaydi shu joyda almashinadi)
      if (!a || (a.target && a.target !== "_self") || a.hasAttribute("download") || a.hasAttribute("data-no-progress")) return;
      // havola ichidagi tugma (masalan, kartadagi "Saqlash") — o'tish emas
      const control = target?.closest?.("button, input, select, textarea, label, [role='button']");
      if (control && a.contains(control) && control !== a) return;
      const to = new URL(a.href, window.location.href);
      if (to.origin !== window.location.origin) return;
      // fayl va API (PDF, rasm) — sahifa emas
      if (/^\/(api|_next)\//.test(to.pathname) || /\.[a-z0-9]{2,5}$/i.test(to.pathname)) return;
      if (to.pathname === window.location.pathname && to.search === window.location.search) return;
      const from = `${window.location.pathname}?${new URLSearchParams(window.location.search).toString()}`;
      const same = to.pathname === window.location.pathname;
      setPending((p) => ({ from, to: to.pathname, same, n: (p?.n ?? 0) + 1, rect: contentRect() }));
      setShown(false);
      if (!same) setPendingPath(to.pathname);
      window.clearTimeout(showTimer);
      window.clearTimeout(hideTimer);
      // oldindan yuklangan sahifa ~0.1 s da o'zi ochiladi — undan tezroq qatlam chiqmaydi (miltillamasin)
      showTimer = window.setTimeout(() => setShown(true), same ? 220 : 70);
      hideTimer = window.setTimeout(clear, 10000);
    };
    // capture: Link o'z onClick'ida preventDefault qiladi — undan oldin ushlaymiz
    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", clear);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", clear);
      window.clearTimeout(hideTimer);
      window.clearTimeout(showTimer);
    };
  }, []);

  // yangi manzil ochildi — qatlam va belgi olib tashlanadi (bir kadr ham eski sahifa ustida qolmasin)
  const arrived = !!pending && pending.from !== url;
  useLayoutEffect(() => {
    if (arrived) setPendingPath(null);
  }, [arrived]);

  const loading = !!pending && !arrived;
  const overlay = loading && shown && !pending.same;
  return (
    <>
      <div className="nav-progress" data-state={!pending?.same ? "idle" : loading ? (shown ? "loading" : "idle") : "done"} aria-hidden>
        {pending?.same && (shown || arrived) ? <span key={pending.n} /> : null}
      </div>
      {overlay ? (
        isBare(pending.to) ? (
          <div className="nav-instant nav-instant-full" data-nav-instant aria-hidden>
            <BareSkeleton />
          </div>
        ) : (
          <div className="nav-instant" style={pending.rect} data-nav-instant aria-hidden>
            <PageSkeleton />
          </div>
        )
      ) : null}
    </>
  );
}

export function NavProgress() {
  return (
    <Suspense fallback={null}>
      <NavProgressBar />
    </Suspense>
  );
}
