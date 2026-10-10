import * as React from "react";
import { Slot } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "press inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl font-semibold disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 select-none",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary-hover shadow-sm",
        secondary: "bg-secondary text-secondary-foreground hover:bg-border/70",
        outline: "border border-border bg-card text-foreground hover:bg-secondary",
        ghost: "text-foreground hover:bg-secondary",
        soft: "bg-primary-soft text-primary hover:bg-primary/15",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        "destructive-soft": "bg-destructive-soft text-destructive hover:bg-destructive/15",
        success: "bg-success text-success-foreground hover:bg-success/90",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 px-5 text-[15px]",
        sm: "h-9 px-3.5 text-sm rounded-lg",
        lg: "h-13 px-6 text-base rounded-2xl",
        xl: "h-14 px-7 text-lg rounded-2xl",
        icon: "h-11 w-11",
        "icon-sm": "h-9 w-9 rounded-lg",
      },
      fullWidth: { true: "w-full" },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, fullWidth, asChild = false, loading = false, disabled, children, ...props }, ref) => {
    // asChild: Slot faqat BITTA bola elementni qabul qiladi (masalan <Link>) — spinner qo'shilmaydi
    if (asChild) {
      return (
        <Slot.Root className={cn(buttonVariants({ variant, size, fullWidth, className }))} ref={ref} {...props}>
          {children}
        </Slot.Root>
      );
    }
    return (
      <button
        className={cn(buttonVariants({ variant, size, fullWidth, className }))}
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
        {children}
      </button>
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
