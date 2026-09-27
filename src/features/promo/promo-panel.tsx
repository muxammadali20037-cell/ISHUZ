"use client";

import { useState } from "react";
import { Copy, Download, Megaphone, Send } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";

/** Ish beruvchi: vakansiya reklama rasmi (post/story) + tayyor matn + ulashish */
export function PromoPanel({ slug, caption, url, isActive }: { slug: string; caption: string; url: string; isActive: boolean }) {
  const { t } = useT();
  const [format, setFormat] = useState<"square" | "story">("square");
  const src = `/api/promo/vacancy/${slug}?f=${format}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(caption);
      toast.success(t("promo.copied"));
    } catch {
      toast.error(t("common.errors.generic"));
    }
  };

  return (
    <section className="mt-6 rounded-2xl border border-border bg-card p-4 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
          <Megaphone className="size-5" />
        </span>
        <div>
          <h2 className="text-lg font-bold">{t("promo.title")}</h2>
          <p className="text-sm text-muted-foreground">{t("promo.subtitle")}</p>
          {!isActive ? <p className="mt-1 text-xs font-medium text-warning">{t("promo.draft_note")}</p> : null}
        </div>
      </div>

      <div className="mt-4 inline-flex rounded-xl bg-secondary p-1">
        {(["square", "story"] as const).map((f) => (
          <button key={f} type="button" onClick={() => setFormat(f)} className={cn("h-9 rounded-lg px-4 text-sm font-medium transition-colors", format === f ? "bg-card shadow-sm" : "text-muted-foreground")}>
            {t(`promo.${f}`)}
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-5 md:grid-cols-[minmax(0,320px)_1fr]">
        {/* eslint-disable-next-line @next/next/no-img-element -- dinamik PNG (next/og) */}
        <img key={src} src={src} alt={t("promo.title")} className={cn("w-full rounded-2xl border border-border bg-secondary object-cover", format === "story" ? "aspect-[9/16] max-w-[260px]" : "aspect-square")} loading="lazy" />
        <div className="flex min-w-0 flex-col gap-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("promo.caption")}</p>
          <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-xl bg-secondary/60 p-3 font-sans text-sm leading-relaxed">{caption}</pre>
          <div className="grid gap-2 sm:grid-cols-3">
            <Button asChild variant="default">
              <a href={src} download={`ishberuvchi-${slug}-${format}.png`}>
                <Download className="size-4" />
                {t("promo.download")}
              </a>
            </Button>
            <Button variant="soft" onClick={copy}>
              <Copy className="size-4" />
              {t("promo.copy")}
            </Button>
            <Button asChild variant="outline">
              <a href={`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(caption.replace(url, "").trim())}`} target="_blank" rel="noopener noreferrer">
                <Send className="size-4" />
                {t("promo.share_tg")}
              </a>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
