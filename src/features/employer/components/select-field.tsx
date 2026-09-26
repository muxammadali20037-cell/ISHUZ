"use client";

import { Controller, type Control, type FieldPath, type FieldValues } from "react-hook-form";
import { Select, type SelectOption } from "@/components/ui/select";
import { Field } from "@/components/ui/label";

/** react-hook-form bilan boshqariladigan native Select (placeholder rangi to'g'ri ishlashi uchun Controller) */
export function SelectField<TIn extends FieldValues, TOut extends FieldValues = TIn>({
  control,
  name,
  label,
  options,
  placeholder,
  hint,
  error,
  disabled,
  required,
  onValueChange,
}: {
  control: Control<TIn, unknown, TOut>;
  name: FieldPath<TIn>;
  label: string;
  options: SelectOption[];
  placeholder?: string;
  hint?: string;
  error?: string;
  disabled?: boolean;
  required?: boolean;
  onValueChange?: (value: string) => void;
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <Field label={label} htmlFor={field.name} error={error} hint={hint} required={required}>
          <Select
            id={field.name}
            name={field.name}
            ref={field.ref}
            options={options}
            placeholder={placeholder}
            value={typeof field.value === "string" ? field.value : ""}
            onBlur={field.onBlur}
            onChange={(e) => {
              field.onChange(e.target.value);
              onValueChange?.(e.target.value);
            }}
            disabled={disabled}
            invalid={!!error}
          />
        </Field>
      )}
    />
  );
}
