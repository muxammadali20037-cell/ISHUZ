import {
  BadgeCheck,
  CalendarClock,
  CircleAlert,
  FileText,
  Handshake,
  Hourglass,
  Megaphone,
  MessageCircle,
  Reply,
  Sparkles,
  Star,
  UserCheck,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { NotificationIcon as IconKey } from "../render";

const ICONS: Record<IconKey, { icon: LucideIcon; tone: string }> = {
  application: { icon: FileText, tone: "bg-primary-soft text-primary" },
  status: { icon: CircleAlert, tone: "bg-warning-soft text-warning" },
  offer: { icon: Handshake, tone: "bg-success-soft text-success" },
  offer_response: { icon: Reply, tone: "bg-success-soft text-success" },
  message: { icon: MessageCircle, tone: "bg-primary-soft text-primary" },
  interview: { icon: CalendarClock, tone: "bg-success-soft text-success" },
  expiring: { icon: Hourglass, tone: "bg-warning-soft text-warning" },
  match_vacancy: { icon: Sparkles, tone: "bg-primary-soft text-primary" },
  match_worker: { icon: UserCheck, tone: "bg-primary-soft text-primary" },
  verification: { icon: BadgeCheck, tone: "bg-success-soft text-success" },
  review: { icon: Star, tone: "bg-warning-soft text-warning" },
  system: { icon: Megaphone, tone: "bg-secondary text-secondary-foreground" },
};

export function NotificationIcon({ kind, className }: { kind: IconKey; className?: string }) {
  const { icon: Icon, tone } = ICONS[kind];
  return (
    <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", tone, className)}>
      <Icon className="size-5" />
    </span>
  );
}
