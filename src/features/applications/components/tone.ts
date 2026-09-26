import type { StatusTone } from "../types";

/** Holat rang sxemasi (Badge fon/matn) */
export const TONE_BADGE: Record<StatusTone, string> = {
  info: "bg-sky-100/80 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200",
  primary: "bg-primary-soft text-primary",
  success: "bg-success-soft text-success",
  destructive: "bg-destructive-soft text-destructive",
  muted: "bg-secondary text-muted-foreground",
};

/** Kichik nuqta */
export const TONE_DOT: Record<StatusTone, string> = {
  info: "bg-sky-500",
  primary: "bg-primary",
  success: "bg-success",
  destructive: "bg-destructive",
  muted: "bg-muted-foreground",
};

/** Timeline: joriy qadam (bo'sh aylana + halqa) */
export const TONE_RING: Record<StatusTone, string> = {
  info: "border-sky-500 text-sky-600 ring-sky-500/15 dark:text-sky-300",
  primary: "border-primary text-primary ring-primary/15",
  success: "border-success text-success ring-success/15",
  destructive: "border-destructive text-destructive ring-destructive/15",
  muted: "border-muted-foreground text-muted-foreground ring-muted-foreground/15",
};

/** Timeline: to'ldirilgan aylana */
export const TONE_FILL: Record<StatusTone, string> = {
  info: "border-sky-500 bg-sky-500 text-white",
  primary: "border-primary bg-primary text-primary-foreground",
  success: "border-success bg-success text-white",
  destructive: "border-destructive bg-destructive text-white",
  muted: "border-muted-foreground bg-muted-foreground text-white",
};

/** Holat banneri (detal sahifa yuqorisi) */
export const TONE_BANNER: Record<StatusTone, string> = {
  info: "border-sky-200 bg-sky-50 dark:border-sky-900 dark:bg-sky-950/40",
  primary: "border-primary/30 bg-primary-soft/60",
  success: "border-success/30 bg-success-soft/50",
  destructive: "border-destructive/30 bg-destructive-soft/50",
  muted: "border-border bg-secondary/60",
};
