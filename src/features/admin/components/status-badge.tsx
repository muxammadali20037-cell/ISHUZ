import { Badge, type BadgeProps } from "@/components/ui/badge";

type Variant = NonNullable<BadgeProps["variant"]>;

const MAP: Record<string, Variant> = {
  // vacancy
  draft: "default",
  pending_review: "warning",
  active: "success",
  paused: "default",
  closed: "default",
  expired: "default",
  hidden: "destructive",
  // report
  open: "warning",
  in_review: "primary",
  resolved: "success",
  dismissed: "default",
  // review / verification
  pending: "warning",
  approved: "success",
  rejected: "destructive",
  unverified: "default",
  verified: "success",
  // worker
  not_looking: "default",
};

/** Holat badge'i: enum qiymati → rang; matn tEnum orqali keladi */
export function StatusBadge({ status, label, size }: { status: string; label: string; size?: BadgeProps["size"] }) {
  return (
    <Badge variant={MAP[status] ?? "default"} size={size}>
      {label}
    </Badge>
  );
}

export function BoolBadge({ value, yes, no }: { value: boolean; yes: string; no: string }) {
  return (
    <Badge variant={value ? "success" : "default"} size="sm">
      {value ? yes : no}
    </Badge>
  );
}
