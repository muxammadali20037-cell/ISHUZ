"use client";

import * as React from "react";
import { Checkbox as CheckboxPrimitive, RadioGroup as RadioGroupPrimitive, Switch as SwitchPrimitive } from "radix-ui";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const Checkbox = React.forwardRef<
  React.ComponentRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root> & { label?: React.ReactNode; description?: string }
>(({ className, label, description, id, ...props }, ref) => {
  const autoId = React.useId();
  const inputId = id ?? autoId;
  const box = (
    <CheckboxPrimitive.Root
      ref={ref}
      id={inputId}
      className={cn(
        "peer size-5 shrink-0 rounded-md border border-input bg-card transition-colors data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="flex items-center justify-center text-current">
        <Check className="size-3.5" strokeWidth={3} />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
  if (!label) return box;
  return (
    <label htmlFor={inputId} className="flex cursor-pointer items-start gap-3 py-1">
      <span className="mt-0.5">{box}</span>
      <span className="flex-1 text-[15px] leading-snug">
        {label}
        {description ? <span className="block text-xs text-muted-foreground">{description}</span> : null}
      </span>
    </label>
  );
});
Checkbox.displayName = "Checkbox";

const RadioGroup = RadioGroupPrimitive.Root;

const RadioItem = React.forwardRef<
  React.ComponentRef<typeof RadioGroupPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Item> & { label: React.ReactNode; description?: string }
>(({ className, label, description, id, ...props }, ref) => {
  const autoId = React.useId();
  const inputId = id ?? autoId;
  return (
    <label htmlFor={inputId} className={cn("flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-card p-3.5 transition-colors has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary-soft/60", className)}>
      <RadioGroupPrimitive.Item
        ref={ref}
        id={inputId}
        className="mt-0.5 size-5 shrink-0 rounded-full border border-input bg-card data-[state=checked]:border-primary disabled:opacity-50"
        {...props}
      >
        <RadioGroupPrimitive.Indicator className="flex items-center justify-center">
          <span className="size-2.5 rounded-full bg-primary" />
        </RadioGroupPrimitive.Indicator>
      </RadioGroupPrimitive.Item>
      <span className="flex-1 text-[15px] leading-snug">
        {label}
        {description ? <span className="block text-xs text-muted-foreground">{description}</span> : null}
      </span>
    </label>
  );
});
RadioItem.displayName = "RadioItem";

const Switch = React.forwardRef<React.ComponentRef<typeof SwitchPrimitive.Root>, React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>>(
  ({ className, ...props }, ref) => (
    <SwitchPrimitive.Root
      ref={ref}
      className={cn(
        "inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent bg-secondary transition-colors data-[state=checked]:bg-primary disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="block size-6 rounded-full bg-white shadow-sm transition-transform data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0" />
    </SwitchPrimitive.Root>
  ),
);
Switch.displayName = "Switch";

export { Checkbox, RadioGroup, RadioItem, Switch };
