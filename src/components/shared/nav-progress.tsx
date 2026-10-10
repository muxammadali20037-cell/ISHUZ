"use client";

import { Suspense, useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Havola bosilgan zahoti ekran tepasida ingichka chiziq — server javobini kutmasdan "bosildi, yuklanmoqda" deb
 * ko'rsatadi (sahifa qotib qolgandek tuyulmaydi). Yangi manzil ochilishi bilan to'lib, so'nadi.
 * loading.tsx'dan farqli: sahifaning HTTP holatiga (404, yo'naltirish) ta'sir qilmaydi.
 */
function NavProgressBar() {
  const url = `${usePathname()}?${useSearchParams().toString()}`;
  const [pending, setPending] = useState<{ from: string; n: number } | null>(null);

  useEffect(() => {
    let timer = 0;
    const onClick = (e: MouseEvent) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || (a.target && a.target !== "_self") || a.hasAttribute("download")) return;
      const to = new URL(a.href, window.location.href);
      if (to.origin !== window.location.origin || (to.pathname === window.location.pathname && to.search === window.location.search)) return;
      const from = `${window.location.pathname}?${new URLSearchParams(window.location.search).toString()}`;
      setPending((p) => ({ from, n: (p?.n ?? 0) + 1 }));
      window.clearTimeout(timer);
      // tarmoq uzilsa yoki o'tish bekor qilinsa — chiziq osilib qolmasin
      timer = window.setTimeout(() => setPending(null), 15000);
    };
    // capture: Link o'z onClick'ida preventDefault qiladi — undan oldin ushlaymiz
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.clearTimeout(timer);
    };
  }, []);

  const state = !pending ? "idle" : pending.from === url ? "loading" : "done";
  return (
    <div className="nav-progress" data-state={state} aria-hidden>
      {pending ? <span key={pending.n} /> : null}
    </div>
  );
}

export function NavProgress() {
  return (
    <Suspense fallback={null}>
      <NavProgressBar />
    </Suspense>
  );
}
