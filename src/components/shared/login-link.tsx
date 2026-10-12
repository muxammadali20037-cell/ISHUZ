"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

/** Ochiq e'lon formasi shu hodisani tinglaydi va mehmon qoralamasini kirgan hisobga o'tkazishga tayyorlaydi (use-draft.ts) */
export const AUTH_HANDOFF_EVENT = "ishuz:auth-handoff";

/**
 * "Kirish": kirgandan keyin aynan shu sahifaga (qadam bilan) qaytariladi. JS bo'lmasa — oddiy /auth.
 * Mehmon e'lon formasini to'ldirib turgan bo'lsa, javoblari ham kirgan hisobga o'tadi (avval yo'qolardi).
 */
export function LoginLink({ className, children }: { className?: string; children: ReactNode }) {
  const router = useRouter();
  return (
    <Link
      href="/auth"
      className={className}
      onClick={(e) => {
        const here = `${window.location.pathname}${window.location.search}`;
        if (here === "/" || here.startsWith("/auth")) return;
        e.preventDefault();
        window.dispatchEvent(new Event(AUTH_HANDOFF_EVENT));
        router.push(`/auth?next=${encodeURIComponent(here)}`);
      }}
    >
      {children}
    </Link>
  );
}
