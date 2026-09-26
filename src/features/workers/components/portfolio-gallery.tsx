"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, ExternalLink, FileText, Images, X } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { CandidatePortfolioItem } from "../types";

interface Lightbox {
  item: CandidatePortfolioItem;
  index: number;
}

/** Portfolio: rasm gridi (lightbox), video, PDF/hujjat havolalari, tashqi havola */
export function PortfolioGallery({ items }: { items: CandidatePortfolioItem[] }) {
  const { t, tEnum } = useT();
  const [lightbox, setLightbox] = useState<Lightbox | null>(null);
  if (!items.length) return null;

  const step = (delta: number) => {
    if (!lightbox) return;
    const n = lightbox.item.media.length;
    setLightbox({ item: lightbox.item, index: (lightbox.index + delta + n) % n });
  };
  const current = lightbox?.item.media[lightbox.index];

  return (
    <section className="rounded-2xl border border-border/70 bg-card p-4 sm:p-5">
      <h2 className="mb-3 flex items-center gap-2 text-base font-bold">
        <Images className="size-4.5 text-primary" />
        {t("workers.candidate.portfolio")}
      </h2>
      <ul className="space-y-5">
        {items.map((item) => (
          <li key={item.id}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[15px] font-semibold">{item.title}</p>
                {item.description ? <p className="mt-0.5 text-sm text-muted-foreground">{item.description}</p> : null}
              </div>
              <span className="shrink-0 rounded-lg bg-secondary px-2 py-0.5 text-xs text-muted-foreground">{tEnum("portfolio_type", item.type)}</span>
            </div>

            {item.type === "image" && item.media.length ? (
              <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
                {item.media.map((m, i) => (
                  <button
                    key={m.path}
                    type="button"
                    className="group relative aspect-square overflow-hidden rounded-xl bg-secondary"
                    onClick={() => setLightbox({ item, index: i })}
                    aria-label={`${item.title} ${i + 1}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- tashqi storage, next/image remotePatterns sozlanmagan */}
                    <img src={m.url} alt="" loading="lazy" className="size-full object-cover transition-transform group-hover:scale-105" />
                  </button>
                ))}
              </div>
            ) : null}

            {item.type === "video" && item.media.length ? (
              <div className="mt-3 space-y-2">
                {item.media.map((m) => (
                  <video key={m.path} controls preload="metadata" src={m.url} className="w-full rounded-xl bg-black" />
                ))}
              </div>
            ) : null}

            {(item.type === "pdf" || item.type === "document") && item.media.length ? (
              <ul className="mt-3 space-y-1.5">
                {item.media.map((m, i) => (
                  <li key={m.path}>
                    <a href={m.url} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-3 text-sm font-medium hover:bg-secondary">
                      <FileText className="size-4 text-primary" />
                      {t("workers.candidate.open_file")}
                      {item.media.length > 1 ? ` ${i + 1}` : ""}
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}

            {item.link_url ? (
              <a href={item.link_url} target="_blank" rel="noopener noreferrer nofollow" className="mt-3 inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-3 text-sm font-medium text-primary hover:bg-secondary">
                <ExternalLink className="size-4" />
                {t("workers.candidate.open_link")}
              </a>
            ) : null}
          </li>
        ))}
      </ul>

      <DialogPrimitive.Root open={!!lightbox} onOpenChange={(o) => (!o ? setLightbox(null) : undefined)}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/85 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
          <DialogPrimitive.Content className="fixed inset-0 z-50 flex flex-col items-center justify-center p-4 focus:outline-none">
            <DialogPrimitive.Title className="sr-only">{lightbox?.item.title ?? ""}</DialogPrimitive.Title>
            <DialogPrimitive.Description className="sr-only">{lightbox?.item.description ?? ""}</DialogPrimitive.Description>
            {current ? (
              // eslint-disable-next-line @next/next/no-img-element -- tashqi storage
              <img src={current.url} alt={lightbox?.item.title ?? ""} className="max-h-[85dvh] max-w-full rounded-xl object-contain shadow-lg" />
            ) : null}
            {lightbox && lightbox.item.media.length > 1 ? (
              <>
                <Button type="button" variant="secondary" size="icon" className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full" onClick={() => step(-1)} aria-label={t("common.actions.back")}>
                  <ChevronLeft className="size-6" />
                </Button>
                <Button type="button" variant="secondary" size="icon" className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full" onClick={() => step(1)} aria-label={t("common.actions.next")}>
                  <ChevronRight className="size-6" />
                </Button>
                <p className="mt-3 text-sm text-white/80 tabular">
                  {lightbox.index + 1} / {lightbox.item.media.length}
                </p>
              </>
            ) : null}
            <DialogPrimitive.Close className={cn("absolute right-3 top-3 rounded-full bg-white/10 p-2 text-white hover:bg-white/20")} aria-label={t("common.actions.close")}>
              <X className="size-6" />
            </DialogPrimitive.Close>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </section>
  );
}
