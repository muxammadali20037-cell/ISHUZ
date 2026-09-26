import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs font-medium whitespace-nowrap [&_svg]:size-3.5", {
  variants: {
    variant: {
      default: "bg-secondary text-secondary-foreground",
      primary: "bg-primary-soft text-primary",
      success: "bg-success-soft text-success",
      warning: "bg-warning-soft text-warning",
      destructive: "bg-destructive-soft text-destructive",
      outline: "border border-border text-foreground",
      solid: "bg-primary text-primary-foreground",
    },
    size: {
      default: "",
      sm: "px-1.5 py-0 text-[11px]",
      lg: "px-2.5 py-1 text-sm",
    },
  },
  defaultVariants: { variant: "default", size: "default" },
});

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, size, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant, size }), className)} {...props} />;
}

export { Badge, badgeVariants };
