import type { ReactNode } from "react";

/** Tafsilot qatori (Sheet ichida): kalit — qiymat */
export function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 text-sm">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 text-right font-medium break-words">{children}</span>
    </div>
  );
}

export function DetailSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-4 first:mt-0">
      <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h4>
      <div className="divide-y divide-border/60 rounded-xl border border-border/60 px-3">{children}</div>
    </section>
  );
}
