import * as React from "react";
import { cn } from "@/lib/utils";
import { Input, Textarea } from "./input";
import { Select } from "./select";

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

/** Field ichidagi bevosita boshqaruv elementlari — ularga aria-describedby / aria-invalid avtomatik qo'yiladi */
const FORM_CONTROLS = new Set<unknown>([Input, Textarea, Select]);

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
  // Xato yoki izoh matni maydonga dasturiy bog'lanadi (ekran o'quvchi xatoni maydon bilan birga o'qiydi)
  const messageId = htmlFor && (error || description) ? `${htmlFor}-${error ? "error" : "desc"}` : undefined;
  let control = children;
  if (messageId && React.isValidElement<React.AriaAttributes>(children) && FORM_CONTROLS.has(children.type)) {
    const own = children.props["aria-describedby"];
    control = React.cloneElement(children, {
      "aria-describedby": own ? `${own} ${messageId}` : messageId,
      ...(error ? { "aria-invalid": true } : {}),
    });
  }
  return (
    <div className={cn("space-y-1", className)}>
      {label ? (
        <Label htmlFor={htmlFor} required={required} hint={hint} className={size === "lg" ? "mb-3 text-xl font-semibold leading-snug sm:text-2xl" : undefined}>
          {label}
        </Label>
      ) : null}
      {control}
      {error ? (
        <p id={messageId} className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : description ? (
        <p id={messageId} className="text-xs text-muted-foreground">
          {description}
        </p>
      ) : null}
    </div>
  );
}

export { Label, Field };
