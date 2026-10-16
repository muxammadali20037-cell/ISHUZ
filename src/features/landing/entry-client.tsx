"use client";

import { useFormStatus } from "react-dom";
import { cn } from "@/lib/utils";

/** Maqsad plitkasi tugmasi: forma yuborilayotganda qayta bosilmaydi va "kutilmoqda" holati ko'rinadi (JS'siz ham forma ishlaydi) */
export function TileButton({ className, children, ...props }: React.ComponentProps<"button">) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" {...props} disabled={pending} aria-busy={pending || undefined} className={cn(className, pending && "opacity-70")}>
      {children}
    </button>
  );
}
