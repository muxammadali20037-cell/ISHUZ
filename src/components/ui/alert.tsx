import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Sahifa ichidagi xabar bloki (docs/DESIGN_SYSTEM.md §6–7): ma'lumot, muvaffaqiyat, ogohlantirish, xato.
 * Xato va ogohlantirish — `role="alert"` (ekran o'qigich darhol aytadi), qolganlari — `role="status"`.
 * Qisqa vaqtli bildirishnoma uchun emas (u — toast).
 */
const alertVariants = cva("flex gap-3 rounded-lg border p-4 text-sm [&>svg]:mt-0.5 [&>svg]:size-5 [&>svg]:shrink-0", {
  variants: {
    tone: {
      info: "border-primary/25 bg-primary-soft text-foreground [&>svg]:text-primary-ink",
      success: "border-success/25 bg-success-soft text-foreground [&>svg]:text-success",
      warning: "border-warning/25 bg-warning-soft text-foreground [&>svg]:text-warning",
      destructive: "border-destructive/25 bg-destructive-soft text-foreground [&>svg]:text-destructive",
    },
  },
  defaultVariants: { tone: "info" },
});

const ICONS = { info: Info, success: CheckCircle2, warning: AlertTriangle, destructive: XCircle } as const;

export interface AlertProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title">, VariantProps<typeof alertVariants> {
  title?: React.ReactNode;
  /** o'ng tomondagi amal (masalan "Qayta urinish" tugmasi) */
  action?: React.ReactNode;
}

function Alert({ className, tone = "info", title, action, children, ...props }: AlertProps) {
  const Icon = ICONS[tone ?? "info"];
  const urgent = tone === "destructive" || tone === "warning";
  return (
    <div role={urgent ? "alert" : "status"} data-tone={tone} className={cn(alertVariants({ tone }), className)} {...props}>
      <Icon aria-hidden />
      <div className="min-w-0 flex-1 space-y-1">
        {title ? <p className="font-semibold leading-snug">{title}</p> : null}
        {children ? <div className="leading-relaxed text-muted-foreground">{children}</div> : null}
      </div>
      {action ? <div className="shrink-0 self-center">{action}</div> : null}
    </div>
  );
}

export { Alert, alertVariants };
