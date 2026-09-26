import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Jadval qobig'i: mobil uchun gorizontal skroll */
export function TableWrap({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm", className)}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-sm">{children}</table>
      </div>
    </div>
  );
}

export function Th({ children, className, align = "left" }: { children?: ReactNode; className?: string; align?: "left" | "right" | "center" }) {
  return (
    <th
      scope="col"
      className={cn(
        "whitespace-nowrap border-b border-border/70 bg-secondary/60 px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground first:pl-4 last:pr-4",
        align === "right" && "text-right",
        align === "center" && "text-center",
        align === "left" && "text-left",
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Td({ children, className, align = "left", colSpan }: { children?: ReactNode; className?: string; align?: "left" | "right" | "center"; colSpan?: number }) {
  return (
    <td
      colSpan={colSpan}
      className={cn("border-b border-border/60 px-3 py-2.5 align-middle first:pl-4 last:pr-4", align === "right" && "text-right tabular", align === "center" && "text-center", className)}
    >
      {children}
    </td>
  );
}

export function Tr({ children, className, muted }: { children: ReactNode; className?: string; muted?: boolean }) {
  return <tr className={cn("transition-colors hover:bg-secondary/40 [&:last-child>td]:border-b-0", muted && "opacity-60", className)}>{children}</tr>;
}

export interface Column<T> {
  key: string;
  header: ReactNode;
  align?: "left" | "right" | "center";
  className?: string;
  render: (row: T) => ReactNode;
}

/**
 * Umumiy ma'lumotlar jadvali. Server komponentda ham ishlaydi (render funksiyalari serverda chaqiriladi).
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  empty,
  rowMuted,
  className,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  empty: ReactNode;
  rowMuted?: (row: T) => boolean;
  className?: string;
}) {
  return (
    <TableWrap className={className}>
      <thead>
        <tr>
          {columns.map((c) => (
            <Th key={c.key} align={c.align} className={c.className}>
              {c.header}
            </Th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <Td colSpan={columns.length} className="py-10">
              {empty}
            </Td>
          </tr>
        ) : (
          rows.map((r) => (
            <Tr key={rowKey(r)} muted={rowMuted?.(r)}>
              {columns.map((c) => (
                <Td key={c.key} align={c.align} className={c.className}>
                  {c.render(r)}
                </Td>
              ))}
            </Tr>
          ))
        )}
      </tbody>
    </TableWrap>
  );
}

/** Jadval uchun skeleton */
export function TableSkeleton({ rows = 8, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <TableWrap>
      <thead>
        <tr>
          {Array.from({ length: cols }).map((_, i) => (
            <Th key={i}>
              <span className="block h-3 w-16 animate-pulse rounded bg-border" />
            </Th>
          ))}
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: rows }).map((_, r) => (
          <tr key={r}>
            {Array.from({ length: cols }).map((_, c) => (
              <Td key={c}>
                <span className="block h-3.5 animate-pulse rounded bg-secondary" style={{ width: `${55 + ((r * 7 + c * 13) % 40)}%` }} />
              </Td>
            ))}
          </tr>
        ))}
      </tbody>
    </TableWrap>
  );
}
