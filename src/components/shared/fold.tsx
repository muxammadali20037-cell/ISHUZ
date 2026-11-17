"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import { TINT_TILE, type Tint } from "./tints";

/**
 * Yig'iladigan bo'lim (2026-11-15, ega: "hammasini ichiga yashir — nimaligini bilsin, «ochish», «ko'rish» so'zlari bilan").
 * Yopiq holatda — bitta qator: belgi, nom, son va o'ngda "Ko'rish" / "Ochish"; bosilsa ichi ochiladi ("Yopish").
 * `open` — qaysi ekrandan boshlab har doim ochiq (qator yashiriladi): "lg" — kompyuterda joy bor, ro'yxat to'g'ridan-to'g'ri;
 * "never" — hamma ekranda yig'iladi. Mazmun serverda chiziladi (children), faqat ko'rinishi almashadi.
 */
export function Fold({
  title,
  count,
  icon,
  tint = "blue",
  verb = "open",
  open = "never",
  defaultOpen = false,
  tone = "default",
  name,
  anchor,
  level = 2,
  className,
  bodyClassName,
  children,
}: {
  title: ReactNode;
  count?: number | null;
  /** belgi — tayyor element (server komponentidan funksiya uzatib bo'lmaydi): icon={<Inbox />} */
  icon?: ReactNode;
  /** belgi plitkasining rangi (3.0): ko'k · binafsha · yashil · to'q sariq */
  tint?: Tint;
  /** yopiq qatordagi so'z: "open" — "Ochish", "view" — "Ko'rish" */
  verb?: "open" | "view";
  open?: "lg" | "never";
  defaultOpen?: boolean;
  tone?: "default" | "soft";
  /** testlar va tahlil uchun: data-fold="…" */
  name?: string;
  /** havola shu bo'limga olib kelsa (masalan /cabinet#pro) — bo'lim o'zi ochiladi */
  anchor?: string;
  /** sarlavha darajasi: tugma sarlavha ichida (WAI-ARIA "accordion" namunasi) — ekran o'quvchida bo'lim nomi sarlavha bo'lib qoladi */
  level?: 2 | 3;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}) {
  const { t } = useT();
  const [shown, setShown] = useState(defaultOpen);
  const id = useId();
  const H = level === 3 ? "h3" : "h2";
  useEffect(() => {
    if (!anchor) return;
    const apply = () => {
      if (window.location.hash === `#${anchor}`) setShown(true);
    };
    apply();
    window.addEventListener("hashchange", apply);
    return () => window.removeEventListener("hashchange", apply);
  }, [anchor]);
  return (
    <section data-fold={name} data-open={shown ? "" : undefined} className={cn("min-w-0", className)}>
      <H className={cn("m-0", open === "lg" && "lg:hidden")}>
      <button
        type="button"
        data-fold-toggle
        aria-expanded={shown}
        aria-controls={id}
        onClick={() => setShown((v) => !v)}
        className={cn(
          "press flex min-h-16 w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-colors",
          tone === "soft" ? "border-primary/20 bg-primary-soft/60 hover:border-primary/40" : "border-border/70 bg-card shadow-sm hover:border-primary/40",
          shown && "rounded-b-none border-b-transparent shadow-none",
        )}
      >
        {icon ? (
          <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl [&>svg]:size-5", TINT_TILE[tint])} aria-hidden>
            {icon}
          </span>
        ) : null}
        <span className="min-w-0 flex-1 text-base font-bold leading-tight">
          {title}
          {count ? (
            <span className="ml-2 inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-secondary px-2 align-middle text-sm font-semibold text-muted-foreground">
              {count > 999 ? "999+" : count}
            </span>
          ) : null}
        </span>
        <span className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-primary-ink">
          {shown ? t("easy.fold.close") : t(verb === "view" ? "easy.fold.view" : "easy.fold.open")}
          <ChevronDown className={cn("size-4 transition-transform", shown && "rotate-180")} aria-hidden />
        </span>
      </button>
      </H>
      <div
        id={id}
        className={cn(
          shown ? "block rounded-b-2xl border border-t-0 px-4 pb-4 pt-1" : "hidden",
          shown && (tone === "soft" ? "border-primary/20 bg-primary-soft/60" : "border-border/70 bg-card shadow-sm"),
          // kompyuterda (open="lg") — har doim ochiq, ramkasiz: sahifa o'z ko'rinishida
          open === "lg" && "lg:block lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0",
          bodyClassName,
        )}
      >
        {children}
      </div>
    </section>
  );
}
