import { Badge } from "@/components/ui/badge";
import type { Enums } from "@/types/database.types";

type Variant = "default" | "primary" | "success" | "warning" | "destructive" | "outline";

const VACANCY: Record<Enums<"vacancy_status">, Variant> = {
  draft: "outline",
  pending_review: "warning",
  active: "success",
  paused: "warning",
  closed: "default",
  expired: "default",
  hidden: "destructive",
  rejected: "destructive",
};

const APPLICATION: Record<Enums<"application_status">, Variant> = {
  sent: "primary",
  viewed: "default",
  shortlisted: "primary",
  interview: "warning",
  offered: "warning",
  hired: "success",
  rejected: "destructive",
  withdrawn: "outline",
};

const VERIFICATION: Record<Enums<"verification_status">, Variant> = {
  unverified: "outline",
  pending: "warning",
  verified: "success",
  rejected: "destructive",
  suspended: "destructive",
};

export function VacancyStatusBadge({ status, label }: { status: Enums<"vacancy_status">; label: string }) {
  return <Badge variant={VACANCY[status]}>{label}</Badge>;
}

export function ApplicationStatusBadge({ status, label }: { status: Enums<"application_status">; label: string }) {
  return <Badge variant={APPLICATION[status]}>{label}</Badge>;
}

export function VerificationBadge({ status, label, size }: { status: Enums<"verification_status">; label: string; size?: "default" | "sm" | "lg" }) {
  return (
    <Badge variant={VERIFICATION[status]} size={size}>
      {label}
    </Badge>
  );
}
