import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "children"> {
  options: SelectOption[];
  placeholder?: string;
  invalid?: boolean;
}

/**
 * Native <select>: mobil qurilmalarda eng qulay va tez. Dizayn tokenlari bilan bezatilgan.
 */
const Select = React.forwardRef<HTMLSelectElement, SelectProps>(({ className, options, placeholder, invalid, value, defaultValue, ...props }, ref) => (
  <div className="relative">
    <select
      ref={ref}
      className={cn(
        "flex h-12 w-full appearance-none rounded-xl border bg-card pl-4 pr-10 text-[15px] text-foreground transition-colors",
        "focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-0 disabled:opacity-60",
        invalid ? "border-destructive" : "border-input",
        (value === "" || (value === undefined && defaultValue === undefined)) && placeholder ? "text-muted-foreground" : "",
        className,
      )}
      value={value}
      defaultValue={defaultValue ?? (value === undefined ? "" : undefined)}
      aria-invalid={invalid || undefined}
      {...props}
    >
      {placeholder !== undefined ? (
        <option value="" disabled={props.required}>
          {placeholder}
        </option>
      ) : null}
      {options.map((o) => (
        <option key={o.value} value={o.value} disabled={o.disabled}>
          {o.label}
        </option>
      ))}
    </select>
    <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
  </div>
));
Select.displayName = "Select";

export { Select };
