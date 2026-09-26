"use client";

import { useEffect } from "react";
import { touchLastSeen } from "@/features/auth/actions";

/** Foydalanuvchi faolligini belgilaydi (DAU/WAU statistikasi, last_active_at) */
export function LastSeenPing() {
  useEffect(() => {
    void touchLastSeen();
    const id = setInterval(() => void touchLastSeen(), 5 * 60 * 1000);
    return () => clearInterval(id);
  }, []);
  return null;
}
