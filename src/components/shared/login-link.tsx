"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

/** "Kirish": kirgandan keyin aynan shu sahifaga (qadam bilan) qaytariladi. JS bo'lmasa — oddiy /auth */
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
        router.push(`/auth?next=${encodeURIComponent(here)}`);
      }}
    >
      {children}
    </Link>
  );
}
