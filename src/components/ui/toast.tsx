"use client";

import * as React from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastKind = "success" | "error" | "info";
type ToastItem = { id: number; kind: ToastKind; title: string; description?: string };

type Listener = (toasts: ToastItem[]) => void;
let toasts: ToastItem[] = [];
let listeners: Listener[] = [];
let counter = 0;

function emit() {
  listeners.forEach((l) => l(toasts));
}

function push(kind: ToastKind, title: string, description?: string) {
  const id = ++counter;
  toasts = [...toasts, { id, kind, title, description }].slice(-4);
  emit();
  setTimeout(() => dismiss(id), kind === "error" ? 6000 : 3500);
  return id;
}

function dismiss(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
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
            className="pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-xl border border-border bg-card p-3.5 shadow-lg animate-in slide-in-from-top-2 fade-in-0"
          >
            <Icon className={cn("mt-0.5 size-5 shrink-0", tones[t.kind])} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{t.title}</p>
              {t.description ? <p className="mt-0.5 text-sm text-muted-foreground">{t.description}</p> : null}
            </div>
            <button type="button" onClick={() => dismiss(t.id)} className="-m-1 rounded-md p-1 text-muted-foreground hover:bg-secondary" aria-label="Close">
              <X className="size-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
