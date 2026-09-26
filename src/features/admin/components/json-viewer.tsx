"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Json } from "@/types/database.types";

/** JSON ko'rsatkich: yig'iladigan <pre> blok */
export function JsonViewer({ value, label, defaultOpen = false, className }: { value: Json | null | undefined; label: string; defaultOpen?: boolean; className?: string }) {
  const [open, setOpen] = useState(defaultOpen);
  if (value === null || value === undefined) return <span className="text-xs text-muted-foreground">—</span>;
  const text = JSON.stringify(value, null, 2);
  const short = text.length <= 60 && !text.includes("\n");
  return (
    <div className={cn("min-w-0", className)}>
      <button type="button" onClick={() => setOpen((o) => !o)} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline" aria-expanded={open}>
        {open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
        {label}
        {!open && short ? <code className="ml-1 rounded bg-secondary px-1 py-0.5 text-[11px] text-muted-foreground">{text}</code> : null}
      </button>
      {open ? <pre className="mt-1.5 max-h-72 max-w-full overflow-auto rounded-lg bg-secondary/70 p-3 text-[11px] leading-relaxed text-foreground">{text}</pre> : null}
    </div>
  );
}
