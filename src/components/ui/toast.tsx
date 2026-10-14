"use client";

import * as React from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastKind = "success" | "error" | "info";
/** ms — ko'rinish vaqti (pastdagi chiziq shu vaqtda tugaydi); leaving — yopilish animatsiyasi (300 ms), keyin olib tashlanadi */
type ToastItem = { id: number; kind: ToastKind; title: string; description?: string; ms: number; leaving?: boolean };

type Listener = (toasts: ToastItem[]) => void;
let toasts: ToastItem[] = [];
let listeners: Listener[] = [];
let counter = 0;

function emit() {
  listeners.forEach((l) => l(toasts));
}

const LEAVE_MS = 300;

function push(kind: ToastKind, title: string, description?: string) {
  const id = ++counter;
  const ms = kind === "error" ? 6000 : 3500;
  toasts = [...toasts, { id, kind, title, description, ms }].slice(-4);
  emit();
  setTimeout(() => dismiss(id), ms);
  return id;
}

function dismiss(id: number) {
  const item = toasts.find((t) => t.id === id);
  if (!item || item.leaving) return;
  // operator panelidagi kabi: avval o'ngga chiqib ketadi, keyin ro'yxatdan olinadi
  toasts = toasts.map((t) => (t.id === id ? { ...t, leaving: true } : t));
  emit();
  const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  setTimeout(
    () => {
      toasts = toasts.filter((t) => t.id !== id);
      emit();
    },
    reduce ? 0 : LEAVE_MS,
  );
}

/** Har qanday joydan: toast.success('Saqlandi') */
export const toast = {
  success: (title: string, description?: string) => push("success", title, description),
  error: (title: string, description?: string) => push("error", title, description),
  info: (title: string, description?: string) => push("info", title, description),
  dismiss,
};

const icons = { success: CheckCircle2, error: AlertCircle, info: Info };
const tones = { success: "text-success", error: "text-destructive", info: "text-primary" };
const timerTones = { success: "bg-success/40", error: "bg-destructive/40", info: "bg-primary/40" };

export function Toaster() {
  const [items, setItems] = React.useState<ToastItem[]>([]);
  React.useEffect(() => {
    listeners.push(setItems);
    return () => {
      listeners = listeners.filter((l) => l !== setItems);
    };
  }, []);
  if (!items.length) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[100] flex flex-col items-center gap-2 px-4 sm:top-4" role="status" aria-live="polite">
      {items.map((t) => {
        const Icon = icons[t.kind];
        return (
          <div
            key={t.id}
            className={cn(
              "relative flex w-full max-w-md items-start gap-3 overflow-hidden rounded-xl border border-border bg-card p-3.5 shadow-lg",
              t.leaving ? "toast-out pointer-events-none" : "toast-in pointer-events-auto",
            )}
          >
            <Icon className={cn("mt-0.5 size-5 shrink-0", tones[t.kind])} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{t.title}</p>
              {t.description ? <p className="mt-0.5 text-sm text-muted-foreground">{t.description}</p> : null}
            </div>
            <button type="button" onClick={() => dismiss(t.id)} className="-m-1 rounded-md p-1 text-muted-foreground hover:bg-secondary" aria-label="Close">
              <X className="size-4" />
            </button>
            {/* qancha vaqt qolgani (operator paneli kabi) */}
            <span aria-hidden className={cn("toast-timer absolute inset-x-0 bottom-0 h-0.5", timerTones[t.kind])} style={{ animationDuration: `${t.ms}ms` }} />
          </div>
        );
      })}
    </div>
  );
}
