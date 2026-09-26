"use client";

import { useRef, type ReactNode } from "react";
import Link from "next/link";
import { Search, X } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { Input } from "@/components/ui/input";
import { Select, type SelectOption } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Filtrlar: GET forma. Select o'zgarganda avtomatik yuboriladi, qidiruv Enter/tugma bilan.
 * <Filters action="/admin/users" reset="/admin/users"> <FilterSearch name="q" .../> <FilterSelect .../> </Filters>
 */
export function Filters({ action, children, hasActive, className }: { action: string; children: ReactNode; hasActive?: boolean; className?: string }) {
  const { t } = useT();
  const ref = useRef<HTMLFormElement>(null);
  return (
    <form ref={ref} action={action} method="get" className={cn("mb-4 flex flex-wrap items-end gap-2", className)} data-filters>
      {children}
      <Button type="submit" variant="secondary" size="sm" className="h-10">
        {t("common.actions.apply")}
      </Button>
      {hasActive ? (
        <Button asChild variant="ghost" size="sm" className="h-10">
          <Link href={action}>
            <X className="size-4" />
            {t("common.actions.clear")}
          </Link>
        </Button>
      ) : null}
    </form>
  );
}

export function FilterSearch({ name, defaultValue, placeholder, className }: { name: string; defaultValue?: string; placeholder: string; className?: string }) {
  return (
    <div className={cn("w-full sm:w-72", className)}>
      <Input name={name} defaultValue={defaultValue} placeholder={placeholder} leftIcon={<Search />} className="h-10 rounded-lg text-sm" autoComplete="off" />
    </div>
  );
}

export function FilterSelect({
  name,
  label,
  options,
  defaultValue,
  placeholder,
  className,
}: {
  name: string;
  label?: string;
  options: SelectOption[];
  defaultValue?: string;
  placeholder: string;
  className?: string;
}) {
  return (
    <label className={cn("block w-full sm:w-48", className)}>
      {label ? <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span> : null}
      <Select
        name={name}
        options={options}
        placeholder={placeholder}
        defaultValue={defaultValue ?? ""}
        className="h-10 rounded-lg text-sm"
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
      />
    </label>
  );
}

export function FilterInput({ name, label, type = "text", defaultValue, placeholder, className, min, max }: { name: string; label?: string; type?: string; defaultValue?: string; placeholder?: string; className?: string; min?: number; max?: number }) {
  return (
    <label className={cn("block w-full sm:w-40", className)}>
      {label ? <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span> : null}
      <Input name={name} type={type} defaultValue={defaultValue} placeholder={placeholder} min={min} max={max} className="h-10 rounded-lg text-sm" />
    </label>
  );
}

/** Yashirin maydon (tab holatini saqlash uchun) */
export function FilterHidden({ name, value }: { name: string; value: string }) {
  return value ? <input type="hidden" name={name} value={value} /> : null;
}
