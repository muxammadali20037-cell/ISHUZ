"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { jobsHref, parseJobsSearchParams } from "../search-params";

/** Qidiruv maydoni: submit → /jobs?q=... (boshqa filtrlar saqlanadi, page 1) */
export function JobsSearchBar({ className }: { className?: string }) {
  const { t } = useT();
  const router = useRouter();
  const sp = useSearchParams();
  const current = parseJobsSearchParams(new URLSearchParams(sp.toString()));
  const [value, setValue] = useState(current.q || current.from);
  const [pending, startTransition] = useTransition();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const q = value.replace(/\s+/g, " ").trim();
    startTransition(() => router.push(jobsHref(current, { q, page: 1, exact: false, from: "" })));
  };

  return (
    <form onSubmit={submit} role="search" className={className}>
      <Input
        type="search"
        name="q"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={t("common.labels.search_placeholder")}
        aria-label={t("common.actions.search")}
        autoComplete="off"
        enterKeyHint="search"
        maxLength={120}
        leftIcon={<Search />}
        rightSlot={
          <span className="flex items-center gap-1">
            {value ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={t("common.actions.clear")}
                onClick={() => {
                  setValue("");
                  if (current.q || current.from) startTransition(() => router.push(jobsHref(current, { q: "", page: 1, exact: false, from: "" })));
                }}
              >
                <X className="size-4" />
              </Button>
            ) : null}
            <Button type="submit" size="sm" loading={pending} className="hidden sm:inline-flex">
              {t("common.actions.search")}
            </Button>
          </span>
        }
        className="sm:pr-36"
      />
    </form>
  );
}
