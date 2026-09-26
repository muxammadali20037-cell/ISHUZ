"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { jobsHref } from "../../search-params";

/** Bosh sahifadagi qidiruv → /jobs?q= */
export function HomeSearch({ className }: { className?: string }) {
  const { t } = useT();
  const router = useRouter();
  const [value, setValue] = useState("");
  const [pending, startTransition] = useTransition();
  const submit = (e: FormEvent) => {
    e.preventDefault();
    startTransition(() => router.push(jobsHref({ q: value.replace(/\s+/g, " ").trim() })));
  };
  return (
    <form onSubmit={submit} role="search" className={className}>
      <Input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={t("common.labels.search_placeholder")}
        aria-label={t("common.actions.search")}
        autoComplete="off"
        enterKeyHint="search"
        maxLength={120}
        leftIcon={<Search />}
        rightSlot={
          <Button type="submit" size="sm" loading={pending}>
            {t("common.actions.search")}
          </Button>
        }
        className="pr-28 shadow-sm"
      />
    </form>
  );
}
