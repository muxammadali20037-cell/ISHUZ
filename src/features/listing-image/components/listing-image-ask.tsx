"use client";

import { useState } from "react";
import { ImagePlus, Loader2, RotateCcw, Sparkles } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";

type State = { step: "ask" } | { step: "busy" } | { step: "done"; url: string; at: number } | { step: "error"; code: string } | { step: "no" };

/** Qayta urinish mantiqli bo'lgan xatolar (cheklov va taqiq emas) */
const RETRY = new Set(["generation_failed", "network", "unavailable", "busy", "rate_limited"]);

/**
 * E'lon joylangach — "E'lon rasmi yaratilsinmi?" (ega, 2026-11-20). Ha → AI e'lonni o'qib mos real surat chizadi
 * (20–60 s), ustiga shablon bilan kasb, maosh va joy yoziladi; e'londa va Telegram kanaldagi postda ko'rinadi.
 * Yo'q → savol yopiladi. Faqat rasm modeli sozlangan bo'lsa ko'rsatiladi (server `enabled`).
 */
export function ListingImageAsk({ entity, id, preview }: { entity: "vacancy" | "worker"; id: string; /** tayyor post rasmi (shablon + surat) */ preview: string }) {
  const { t } = useT();
  const [state, setState] = useState<State>({ step: "ask" });

  const create = async () => {
    setState({ step: "busy" });
    try {
      const res = await fetch("/api/listing-image", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ entity, id }) });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; url?: string; error?: string } | null;
      if (data?.ok && data.url) setState({ step: "done", url: data.url, at: Date.now() });
      else setState({ step: "error", code: data?.error ?? "generation_failed" });
    } catch {
      setState({ step: "error", code: "network" });
    }
  };

  if (state.step === "no") return null;
  return (
    <section className="mt-6 rounded-2xl border border-border bg-card p-4 text-left shadow-sm" data-listing-image={state.step} aria-live="polite">
      {state.step === "ask" ? (
        <>
          <div className="flex items-start gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary-ink" aria-hidden>
              <ImagePlus className="size-6" />
            </span>
            <div className="min-w-0">
              <h2 className="text-lg font-extrabold leading-snug">{t("easy.listing_image.ask_title")}</h2>
              <p className="mt-1 text-sm leading-snug text-muted-foreground">{t("easy.listing_image.ask_desc")}</p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2.5">
            <Button type="button" size="lg" className="text-base" onClick={create} data-listing-image-yes>
              <Sparkles className="size-5" aria-hidden /> {t("easy.listing_image.yes")}
            </Button>
            <Button type="button" variant="outline" size="lg" className="text-base" onClick={() => setState({ step: "no" })} data-listing-image-no>
              {t("easy.listing_image.no")}
            </Button>
          </div>
        </>
      ) : null}

      {state.step === "busy" ? (
        <div className="space-y-3">
          <div className="flex aspect-[3/2] w-full items-center justify-center rounded-xl bg-secondary motion-safe:animate-pulse">
            <Loader2 className="size-8 animate-spin text-primary-ink" aria-hidden />
          </div>
          <p className="text-base font-semibold">{t("easy.listing_image.busy")}</p>
          <p className="text-sm text-muted-foreground">{t("easy.listing_image.busy_note")}</p>
        </div>
      ) : null}

      {state.step === "done" ? (
        <div className="space-y-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- tayyor post rasmi (o'z API'miz), yangilangan manzil bilan */}
          <img
            src={`${preview}${preview.includes("?") ? "&" : "?"}img=${state.at}`}
            alt={t("easy.listing_image.done_alt")}
            className="aspect-[3/2] w-full rounded-xl border border-border object-cover"
            onError={(e) => {
              // post rasmi hali ochiq emas (masalan, tekshiruvda) — suratning o'zi
              if (e.currentTarget.src !== state.url) e.currentTarget.src = state.url;
            }}
          />
          <p className="text-base font-semibold text-success">{t("easy.listing_image.done")}</p>
        </div>
      ) : null}

      {state.step === "error" ? (
        <div className="space-y-3">
          <p className="text-base">{t(`easy.listing_image.error_${["moderation", "user_limit", "daily_limit", "too_many"].includes(state.code) ? state.code : "generic"}`)}</p>
          <div className="flex flex-wrap gap-2">
            {RETRY.has(state.code) ? (
              <Button type="button" variant="outline" className="h-11 text-base" onClick={create}>
                <RotateCcw className="size-5" aria-hidden /> {t("easy.listing_image.retry")}
              </Button>
            ) : null}
            <Button type="button" variant="ghost" className="h-11 text-base" onClick={() => setState({ step: "no" })}>
              {t("easy.listing_image.close")}
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
