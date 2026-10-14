"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

/** Oldingi tarix yozuvi shu saytniki: Navigation API (`canGoBack` faqat shu sayt yozuvlari bo'yicha), bo'lmasa — referrer */
function canGoBackInApp(): boolean {
  const nav = (window as unknown as { navigation?: { canGoBack?: boolean } }).navigation;
  if (nav && typeof nav.canGoBack === "boolean") return nav.canGoBack;
  try {
    return !!document.referrer && new URL(document.referrer).origin === window.location.origin && window.history.length > 1;
  } catch {
    return false;
  }
}

/**
 * "Orqaga": sayt ichidan kelingan bo'lsa — aynan oldingi sahifaga (qidiruv natijalari, o'sha joyiga), aks holda
 * (havola orqali to'g'ridan-to'g'ri ochilgan) — `fallback` sahifaga. Oddiy havola sifatida ham ishlaydi (yangi oynada ochish).
 */
export function BackLink({ fallback, className, children, label }: { fallback: string; className?: string; children: ReactNode; label?: string }) {
  const router = useRouter();
  return (
    <Link
      href={fallback}
      className={className}
      aria-label={label}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        if (canGoBackInApp()) {
          e.preventDefault();
          router.back();
        }
      }}
    >
      {children}
    </Link>
  );
}
