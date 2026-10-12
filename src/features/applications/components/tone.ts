import type { StatusTone } from "../types";

/** Holat rang sxemasi (Badge fon/matn) */
export const TONE_BADGE: Record<StatusTone, string> = {
  info: "bg-info-soft text-info",
  primary: "bg-primary-soft text-primary",
  success: "bg-success-soft text-success",
  destructive: "bg-destructive-soft text-destructive",
  muted: "bg-secondary text-muted-foreground",
};

/** Kichik nuqta */
export const TONE_DOT: Record<StatusTone, string> = {
  info: "bg-info",
  primary: "bg-primary",
  success: "bg-success",
  destructive: "bg-destructive",
  muted: "bg-muted-foreground",
};

/** Timeline: joriy qadam (bo'sh aylana + halqa) */
export const TONE_RING: Record<StatusTone, string> = {
  info: "border-info text-info ring-info/15",
  primary: "border-primary text-primary ring-primary/15",
  success: "border-success text-success ring-success/15",
  destructive: "border-destructive text-destructive ring-destructive/15",
  muted: "border-muted-foreground text-muted-foreground ring-muted-foreground/15",
};

/** Timeline: to'ldirilgan aylana */
export const TONE_FILL: Record<StatusTone, string> = {
  info: "border-info bg-info text-info-foreground",
  primary: "border-primary bg-primary text-primary-foreground",
  success: "border-success bg-success text-success-foreground",
  destructive: "border-destructive bg-destructive text-destructive-foreground",
  muted: "border-muted-foreground bg-muted-foreground text-card",
};

/** Holat banneri (detal sahifa yuqorisi) */
export const TONE_BANNER: Record<StatusTone, string> = {
  info: "border-info/30 bg-info-soft/60",
  primary: "border-primary/30 bg-primary-soft/60",
  success: "border-success/30 bg-success-soft/50",
  destructive: "border-destructive/30 bg-destructive-soft/50",
  muted: "border-border bg-secondary/60",
};
