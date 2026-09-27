"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Server sahifani har N soniyada yangilaydi (to'lov tasdig'ini kutish) */
export function AutoRefresh({ seconds }: { seconds: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => router.refresh(), seconds * 1000);
    return () => clearInterval(id);
  }, [router, seconds]);
  return null;
}
