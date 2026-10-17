"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const noop = () => () => {};

/** Gidratsiyadan keyin true: JS ishlamasa tugmalar o'chirilmaydi (forma brauzerning `required` tekshiruvi bilan ishlaydi) */
export function useHydrated(): boolean {
  return useSyncExternalStore(noop, () => true, () => false);
}

/** Forma yuborilayotganda — yuklanish holati, ikki marta bosilmaydi */
export function EntrySubmit({ children, disabled, className, arrow = true }: { children: ReactNode; disabled?: boolean; className?: string; arrow?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" fullWidth loading={pending} disabled={disabled || pending} aria-disabled={disabled || pending} className={cn("h-14 text-base font-bold", className)}>
      {children}
      {arrow && !pending ? <ArrowRight className="size-5" aria-hidden /> : null}
    </Button>
  );
}
