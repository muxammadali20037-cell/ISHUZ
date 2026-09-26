"use client";

import { useState, type ReactNode } from "react";
import { Eye } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Dialog, Sheet } from "@/components/ui/dialog";

/**
 * Qator tafsilotlari: tugma → Sheet. children serverda render qilinadi (ReactNode sifatida keladi).
 */
export function DetailSheet({
  label,
  title,
  description,
  children,
  footer,
  variant = "ghost",
  size = "sm",
  wide,
  iconOnly,
}: {
  label: string;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  wide?: boolean;
  iconOnly?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button type="button" variant={variant} size={iconOnly ? "icon-sm" : size} onClick={() => setOpen(true)} aria-label={label}>
        <Eye className="size-4" />
        {iconOnly ? null : label}
      </Button>
      <Sheet title={title} description={description} footer={footer} className={wide ? "sm:max-w-3xl" : "sm:max-w-xl"}>
        {children}
      </Sheet>
    </Dialog>
  );
}

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
