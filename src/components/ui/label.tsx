import * as React from "react";
import { cn } from "@/lib/utils";

const Label = React.forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement> & { required?: boolean; hint?: string }>(
  ({ className, required, hint, children, ...props }, ref) => (
    <label ref={ref} className={cn("mb-1.5 block text-sm font-medium text-foreground", className)} {...props}>
      {children}
      {required ? <span className="ml-0.5 text-destructive">*</span> : null}
      {hint ? <span className="ml-1.5 text-xs font-normal text-muted-foreground">({hint})</span> : null}
    </label>
  ),
);
Label.displayName = "Label";

/** Forma maydoni: label + input + xato matni */
function Field({
  label,
  htmlFor,
  required,
  hint,
  error,
  description,
  children,
  className,
  size = "md",
}: {
  label?: string;
  htmlFor?: string;
  required?: boolean;
  hint?: string;
  error?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  /** "lg" — bitta-savol rejimi uchun katta sarlavha */
  size?: "md" | "lg";
}) {
  return (
    <div className={cn("space-y-1", className)}>
      {label ? (
        <Label htmlFor={htmlFor} required={required} hint={hint} className={size === "lg" ? "mb-3 text-xl font-semibold leading-snug sm:text-2xl" : undefined}>
          {label}
        </Label>
      ) : null}
      {children}
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : description ? (
        <p className="text-xs text-muted-foreground">{description}</p>
      ) : null}
    </div>
  );
}

export { Label, Field };
