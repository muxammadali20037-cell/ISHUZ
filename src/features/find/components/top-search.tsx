"use client";

import Form from "next/form";
import { Search } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { AiFinder } from "./ai-finder";

/**
 * Telefonda sarlavhadagi doimiy qidiruv (ega, 2026-11-15: "Uzum'dagidek qidiruvni tepaga chiqar; «Masalan: oshpaz» o'rniga
 * «Ish va ishchilar» tursin"). Odatda — Yordamchi qidiruvi (oddiy so'z bilan, natija oynada); admin "AI bilan qidirish"ni
 * o'chirgan bo'lsa — oddiy matnli qidiruv (/search). Bosh sahifadagi qidiruv maydoni telefonda shu sababli ko'rinmaydi.
 */
export function TopSearch({ mode, ai }: { mode: "jobs" | "workers"; ai: boolean }) {
  const { t } = useT();
  // ish qidiruvchi (4.0, ega "MASTER PROMPT"): "Lavozim yoki kompaniyani qidiring..." (qidiruv kompaniya nomini ham ko'radi);
  // ish beruvchi — "Ish va ishchilar izlash"
  const label = t(mode === "jobs" ? "easy.finder.top_placeholder_jobs" : "easy.finder.top_placeholder");
  if (ai) return <AiFinder variant="top" defaultMode={mode} locked fieldLabel={label} placeholder={label} submitLabel={t("easy.home2.submit")} />;
  return (
    <Form
      action="/search"
      prefetch={false}
      role="search"
      aria-label={label}
      data-top-search
      className="flex h-12 items-center gap-2 rounded-xl border border-transparent bg-secondary pl-3 pr-1 transition-colors focus-within:border-primary focus-within:bg-card focus-within:ring-2 focus-within:ring-ring/25"
    >
      <input type="hidden" name="mode" value={mode} />
      <Search className="size-5 shrink-0 text-muted-foreground" aria-hidden />
      <input
        name="q"
        type="search"
        enterKeyHint="search"
        aria-label={label}
        placeholder={label}
        maxLength={120}
        minLength={2}
        required
        className="h-full min-w-0 flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground"
      />
      <button type="submit" className="press tap-target relative inline-flex h-10 shrink-0 items-center rounded-lg bg-primary px-3.5 text-sm font-bold text-primary-foreground hover:bg-primary-hover">
        {t("easy.home2.submit")}
      </button>
    </Form>
  );
}
