import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
  leftIcon?: React.ReactNode;
  rightSlot?: React.ReactNode;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, type, invalid, leftIcon, rightSlot, ...props }, ref) => {
  const base = cn(
    "flex h-12 w-full rounded-xl border bg-card px-4 text-[15px] text-foreground placeholder:text-muted-foreground transition-colors",
    "focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-0",
    "disabled:cursor-not-allowed disabled:opacity-60",
    invalid ? "border-destructive focus-visible:border-destructive focus-visible:ring-destructive/20" : "border-input",
    leftIcon && "pl-11",
    rightSlot && "pr-12",
    className,
  );
  if (!leftIcon && !rightSlot) {
    return <input type={type} className={base} ref={ref} aria-invalid={invalid || undefined} {...props} />;
  }
  return (
    <div className="relative">
      {leftIcon ? <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground [&_svg]:size-5">{leftIcon}</span> : null}
      <input type={type} className={base} ref={ref} aria-invalid={invalid || undefined} {...props} />
      {rightSlot ? <span className="absolute right-3 top-1/2 -translate-y-1/2">{rightSlot}</span> : null}
    </div>
  );
});
Input.displayName = "Input";

const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }>(
  ({ className, invalid, ...props }, ref) => (
    <textarea
      className={cn(
        "flex min-h-[120px] w-full rounded-xl border bg-card px-4 py-3 text-[15px] text-foreground placeholder:text-muted-foreground transition-colors",
        "focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-0 disabled:opacity-60",
        invalid ? "border-destructive" : "border-input",
        className,
      )}
      ref={ref}
      aria-invalid={invalid || undefined}
      {...props}
    />
  ),
);
Textarea.displayName = "Textarea";

export { Input, Textarea };
