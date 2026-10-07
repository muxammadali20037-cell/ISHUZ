"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { celebrate, consumePendingCelebration } from "@/lib/celebrate";

/** Redirect'dan keyin ochilgan sahifada kutilayotgan konfettini otadi */
export function CelebrationListener() {
  const pathname = usePathname();
  useEffect(() => {
    if (consumePendingCelebration()) {
      const id = setTimeout(celebrate, 250);
      return () => clearTimeout(id);
    }
  }, [pathname]);
  return null;
}
