"use client";

import { useEffect, useSyncExternalStore } from "react";
import { Briefcase, UserRound } from "lucide-react";
import { useT } from "@/lib/i18n/client";

/**
 * Rol almashganda (ish izlovchi ↔ ish beruvchi) butun ekranda ~3 soniya yumshoq katta yozuv: "Siz ish beruvchi paneliga
 * o'tdingiz" — joriy tilda. Yozuv yonib, so'ng sekin o'chadi; ostida yangi panel allaqachon ochilayotgan bo'ladi.
 * Bosilsa — darhol yopiladi. Uchala almashtirish joyi (bosh sahifa menyusi, foydalanuvchi menyusi, Sozlamalar)
 * muvaffaqiyatdan keyin announceRoleSwitch() ni chaqiradi. Providers ildiz layoutda — sahifa almashganda ham yashaydi.
 */
type Role = "worker" | "employer";
type Splash = { role: Role; id: number } | null;

const DURATION_MS = 3000;
let current: Splash = null;
const listeners = new Set<() => void>();

function emit(next: Splash) {
  current = next;
  for (const l of listeners) l();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function announceRoleSwitch(role: Role) {
  emit({ role, id: Date.now() });
}

export function RoleSwitchSplash() {
  const { t } = useT();
  const splash = useSyncExternalStore(subscribe, () => current, () => null);

  useEffect(() => {
    if (!splash) return;
    const id = window.setTimeout(() => {
      if (current?.id === splash.id) emit(null);
    }, DURATION_MS);
    return () => window.clearTimeout(id);
  }, [splash]);

  if (!splash) return null;
  const Icon = splash.role === "employer" ? Briefcase : UserRound;
  return (
    <div
      key={splash.id}
      role="status"
      aria-live="polite"
      data-role-splash={splash.role}
      onClick={() => emit(null)}
      className="role-splash fixed inset-0 z-[95] flex flex-col items-center justify-center gap-6 px-8 text-center"
    >
      <span className="role-splash-icon grid size-24 place-items-center rounded-full" aria-hidden>
        <Icon className="size-11" strokeWidth={1.75} />
      </span>
      <p className="role-splash-text max-w-xl text-balance text-3xl font-bold leading-tight tracking-tight sm:text-5xl">
        {t(`common.role_switched.${splash.role}`)}
      </p>
    </div>
  );
}
