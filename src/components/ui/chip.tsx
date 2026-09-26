"use client";

import * as React from "react";
import { X, Check } from "lucide-react";
import { cn } from "@/lib/utils";

/** Tanlanadigan chip (bir yoki ko'p tanlov uchun) */
function Chip({
  selected,
  onClick,
  children,
  className,
  size = "md",
  disabled,
  icon,
}: {
  selected?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-medium transition-colors disabled:opacity-50 [&_svg]:size-4",
        size === "sm" ? "h-8 px-3 text-sm" : size === "lg" ? "h-12 px-5 text-[15px]" : "h-10 px-4 text-sm",
        selected ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground hover:border-primary/40 hover:bg-secondary",
        className,
      )}
    >
      {selected && !icon ? <Check strokeWidth={3} /> : icon}
      {children}
    </button>
  );
}

/** Tanlangan filtr chipi: "Chilonzor ×" */
function FilterChip({ children, onRemove, className }: { children: React.ReactNode; onRemove: () => void; className?: string }) {
  return (
    <span className={cn("inline-flex h-8 items-center gap-1 rounded-full bg-primary-soft pl-3 pr-1.5 text-sm font-medium text-primary", className)}>
      {children}
      <button type="button" onClick={onRemove} className="rounded-full p-0.5 hover:bg-primary/15" aria-label="Remove">
        <X className="size-3.5" />
      </button>
    </span>
  );
}

/** Chiplar guruhi: bitta (single) yoki ko'p (multiple) tanlov */
function ChipGroup<T extends string>({
  options,
  value,
  onChange,
  multiple,
  size,
  className,
}: {
  options: { value: T; label: string; icon?: React.ReactNode }[];
  value: T | T[] | null | undefined;
  onChange: (next: T | T[] | null) => void;
  multiple?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const selectedSet = new Set(Array.isArray(value) ? value : value ? [value] : []);
  return (
    <div className={cn("flex flex-wrap gap-2", className)} role={multiple ? "group" : "radiogroup"}>
      {options.map((o) => (
        <Chip
          key={o.value}
          size={size}
          icon={o.icon}
          selected={selectedSet.has(o.value)}
          onClick={() => {
            if (multiple) {
              const next = new Set(selectedSet);
              if (next.has(o.value)) next.delete(o.value);
              else next.add(o.value);
              onChange([...next]);
            } else {
              onChange(selectedSet.has(o.value) ? null : o.value);
            }
          }}
        >
          {o.label}
        </Chip>
      ))}
    </div>
  );
}

export { Chip, FilterChip, ChipGroup };
