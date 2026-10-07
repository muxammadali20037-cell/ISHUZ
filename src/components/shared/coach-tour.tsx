"use client";

import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { useT } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";
import { WELCOME_COOKIE } from "./welcome-cookie";

export const TOUR_STORAGE_PREFIX = "ib_tour_";

const TOURS = {
  worker: ["worker-jobs", "worker-listing", "worker-more", "bottom-nav"],
  employer: ["employer-post", "employer-stats", "employer-sections", "bottom-nav"],
} as const;

type Role = keyof typeof TOURS;

function storageKey(role: Role) {
  return `${TOUR_STORAGE_PREFIX}${role}_v1`;
}

/** Ko'rilgan turlarni unutish ("Turni qayta ko'rish") */
export function resetCoachTours() {
  try {
    for (const role of Object.keys(TOURS) as Role[]) localStorage.removeItem(storageKey(role));
  } catch {
    /* localStorage yopiq — tur shunchaki qayta chiqmaydi */
  }
}

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

/**
 * Birinchi kirishda har bir muhim tugmani alohida yoritib, bitta jumla bilan tushuntiradi.
 * Elementlar `data-tour="..."` bilan belgilanadi; ko'rinmaydiganlari (masalan, kompyuterda pastki menyu) o'tkazib yuboriladi.
 * Bir marta ko'rsatiladi; "O'tkazib yuborish" har doim bor; /help sahifasidan qayta ochiladi.
 */
export function CoachTour({ role }: { role: Role }) {
  const { t } = useT();
  const [steps, setSteps] = useState<string[] | null>(null);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);

  // Ko'rilmagan bo'lsa — sahifa joylashgach boshlanadi
  useEffect(() => {
    let seen = false;
    try {
      seen = localStorage.getItem(storageKey(role)) === "1";
    } catch {
      seen = true; // saqlab bo'lmasa, har safar ko'rsatib bezovta qilmaymiz
    }
    if (seen) return;
    // Til/rol tanlash oynasi (WelcomeGate) yopilgunicha kutamiz — ikki oyna ustma-ust chiqmasin
    const id = window.setInterval(() => {
      if (!document.cookie.split("; ").some((c) => c.startsWith(`${WELCOME_COOKIE}=`))) return;
      window.clearInterval(id);
      const visible = TOURS[role].filter((name) => {
        const el = document.querySelector<HTMLElement>(`[data-tour="${name}"]`);
        if (!el) return false;
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      });
      if (visible.length) setSteps(visible);
    }, 900);
    return () => window.clearInterval(id);
  }, [role]);

  const current = steps?.[index];

  const measure = useCallback(() => {
    if (!current) return;
    const el = document.querySelector<HTMLElement>(`[data-tour="${current}"]`);
    if (!el) return;
    const r = el.getBoundingClientRect();
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
  }, [current]);

  useLayoutEffect(() => {
    if (!current) return;
    const el = document.querySelector<HTMLElement>(`[data-tour="${current}"]`);
    const fixed = el && getComputedStyle(el).position === "fixed";
    if (el && !fixed) el.scrollIntoView({ block: "center", behavior: "smooth" });
    const id = window.setTimeout(measure, fixed ? 0 : 350);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [current, measure]);

  const finish = useCallback(() => {
    try {
      localStorage.setItem(storageKey(role), "1");
    } catch {
      /* e'tiborsiz */
    }
    setSteps(null);
  }, [role]);

  useEffect(() => {
    if (!current) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current, finish]);

  if (!steps || !current || !rect) return null;

  const pad = 8;
  const isLast = index >= steps.length - 1;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const below = rect.top + rect.height + 200 < vh;
  const cardTop = below ? rect.top + rect.height + pad + 12 : undefined;
  const cardBottom = below ? undefined : vh - rect.top + pad + 12;

  return (
    <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true" aria-labelledby="coach-title">
      {/* yoritilgan joy: atrof qorong'i, element ochiq qoladi */}
      <div
        className="pointer-events-none absolute rounded-2xl ring-2 ring-white/90 transition-all duration-300"
        style={{
          top: rect.top - pad,
          left: rect.left - pad,
          width: rect.width + pad * 2,
          height: rect.height + pad * 2,
          boxShadow: "0 0 0 9999px rgba(15, 23, 42, 0.68)",
        }}
      />
      <div className="absolute inset-x-4 mx-auto max-w-sm rounded-2xl bg-card p-5 text-card-foreground shadow-xl" style={{ top: cardTop, bottom: cardBottom }}>
        <p className="text-xs font-semibold text-muted-foreground">
          {index + 1} / {steps.length}
        </p>
        <h2 id="coach-title" className="mt-1 text-lg font-bold">
          {t(`welcome.coach.${current}.title`)}
        </h2>
        <p className="mt-1 text-[15px] text-muted-foreground">{t(`welcome.coach.${current}.desc`)}</p>
        <div className="mt-4 flex items-center justify-between gap-2">
          <Button type="button" variant="ghost" onClick={finish}>
            {t("welcome.coach.skip")}
          </Button>
          <Button type="button" size="lg" autoFocus onClick={() => (isLast ? finish() : setIndex(index + 1))}>
            {isLast ? t("welcome.coach.done") : t("common.actions.next")}
          </Button>
        </div>
      </div>
    </div>
  );
}
