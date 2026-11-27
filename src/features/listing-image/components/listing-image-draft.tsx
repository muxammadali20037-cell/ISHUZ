"use client";

import { useEffect, useRef, useState } from "react";
import { ImageOff, ImagePlus, Loader2, RefreshCw, RotateCcw, Sparkles } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";
import { AiReportButton } from "@/features/reports/ai-report-button";

/** tekshirish sahifasida yaratilgan rasm: qoralama id (joylashda e'longa biriktiriladi) va manzili */
export interface DraftImage {
  draft: string;
  url: string;
  /** kasbning tayyor rasmi (0093) — qaysi kasbniki; o'zi yaratgan rasmda yo'q */
  preset?: string;
}

type Phase = { step: "idle" } | { step: "preset" } | { step: "busy" } | { step: "error"; code: string };

/** Qayta urinish mantiqli bo'lgan xatolar (cheklov va taqiq emas) */
const RETRY = new Set(["generation_failed", "network", "unavailable", "busy", "rate_limited", "provider_unavailable"]);
const KNOWN = new Set(["moderation", "user_limit", "daily_limit", "too_many", "provider_unavailable"]);

function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) => (Number(c) ^ (Math.floor(Math.random() * 16) >> (Number(c) / 4))).toString(16));
}

/**
 * E'lon rasmi — JOYLANISHIDAN OLDIN, tekshirish sahifasida (ega, 2026-11-22: "rasmni e'lon joylashdan oldin yaratish kerak,
 * ma'qul kelsa joylash kerak"). "Rasm yaratish" → AI e'longa mos surat chizadi (20–60 s) → shu yerda ko'rinadi:
 * ma'qul bo'lsa — e'lon shu rasm bilan joylanadi; "Boshqa rasm" — yangisi; "Rasmsiz" — rasm olib tashlanadi.
 * Har "Boshqa rasm" — yangi qoralama (oldingisi tayyor qoladi: yangisi chiqmasa, eski rasm bilan joylash mumkin).
 * Xatodan keyin "Qayta urinish" — o'sha qoralama. Faqat kirgan foydalanuvchiga va rasm modeli sozlangan bo'lsa.
 *
 * Kasb rasmi (ega, 2026-11-27: "har bitta kasbga rasm yaratib olsak, birinchi qo'yib chiqsin — oddiy rasmni tanlab
 * «Joylash» bossa buzilmasin"): kasb tanlangan va uning tayyor rasmi bor bo'lsa — sahifa ochilganda o'sha rasm oldindan
 * qo'yiladi (kutish va xarajat yo'q), "Joylash" kifoya. Rasm yo'q bo'lsa "Rasm yaratish" avval kasb rasmini yaratadi —
 * keyingi odamlarga ham tayyor turadi. "Boshqa rasm" — faqat shu e'lon uchun yangi rasm. "Rasmsiz" bosilsa — shu kasbga
 * qayta qo'yilmaydi.
 */
export function ListingImageDraft({
  entity,
  professionId,
  title,
  value,
  onChange,
  masterCategory = null,
}: {
  entity: "vacancy" | "worker" | "master";
  professionId: string | null;
  title: string;
  value: DraftImage | null;
  onChange: (next: DraftImage | null) => void;
  /** usta e'loni: xizmat kategoriyasi (rasm sahnasi) */
  masterCategory?: string | null;
}) {
  const { t } = useT();
  const [phase, setPhase] = useState<Phase>({ step: "idle" });
  /** xatodan keyin qayta urinish — o'sha qoralama (va o'sha tur: kasb rasmi yoki alohida) */
  const failed = useRef<{ draft: string; unique: boolean } | null>(null);
  /** "Rasmsiz" bosilgan kasb — uning rasmi qayta qo'yilmaydi */
  const declined = useRef<string | null>(null);
  const valueRef = useRef(value);
  useEffect(() => {
    valueRef.current = value;
  }, [value]);
  const shared = entity !== "master" && !!professionId;

  // kasbning tayyor rasmi — sahifa ochilganda oldindan (bor bo'lsa); o'zi tanlagan/yaratgan rasm almashtirilmaydi
  useEffect(() => {
    const current = valueRef.current;
    if (!shared || !professionId || declined.current === professionId) return;
    if (current && (!current.preset || current.preset === professionId)) return;
    let alive = true;
    const draft = newId();
    setPhase({ step: "preset" });
    fetch("/api/listing-image", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ entity, draft, professionId, preset: true }),
    })
      .then((r) => r.json().catch(() => null) as Promise<{ ok?: boolean; url?: string } | null>)
      .then((data) => {
        if (!alive) return;
        if (data?.ok && data.url) onChange({ draft, url: data.url, preset: professionId });
        // boshqa kasbning oldindan qo'yilgan rasmi qolmasin
        else if (current?.preset) onChange(null);
      })
      .catch(() => undefined)
      .finally(() => alive && setPhase((p) => (p.step === "preset" ? { step: "idle" } : p)));
    return () => {
      alive = false;
    };
    // onChange — ota komponentning yangi funksiyasi har renderda; faqat kasb almashganda
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entity, professionId, shared]);

  const create = async (opts: { retry?: boolean; unique?: boolean } = {}) => {
    const again = opts.retry && failed.current;
    const draft = again ? failed.current!.draft : newId();
    const unique = again ? failed.current!.unique : !!opts.unique;
    failed.current = null;
    setPhase({ step: "busy" });
    try {
      const res = await fetch("/api/listing-image", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ entity, draft, professionId, title: title.trim().slice(0, 120) || null, ...(entity === "master" ? { masterCategory } : {}), ...(unique ? { unique: true } : {}) }),
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; url?: string; error?: string } | null;
      if (data?.ok && data.url) {
        // birinchi "Rasm yaratish" kasb rasmini yaratadi — u ham kasbniki (boshqa kasb tanlansa almashtiriladi)
        onChange({ draft, url: data.url, ...(shared && !unique && professionId ? { preset: professionId } : {}) });
        setPhase({ step: "idle" });
      } else {
        failed.current = { draft, unique };
        setPhase({ step: "error", code: data?.error ?? "generation_failed" });
      }
    } catch {
      failed.current = { draft, unique };
      setPhase({ step: "error", code: "network" });
    }
  };

  const remove = () => {
    if (value?.preset) declined.current = value.preset;
    onChange(null);
  };

  const state = phase.step === "busy" ? "busy" : phase.step === "preset" ? "preset" : phase.step === "error" ? "error" : value ? "ready" : "ask";
  return (
    <section className="rounded-xl border border-border bg-card p-4 shadow-sm" data-listing-image={state} aria-live="polite">
      {state === "ask" ? (
        <>
          <div className="flex items-start gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-ink" aria-hidden>
              <ImagePlus className="size-6" />
            </span>
            <div className="min-w-0">
              <h2 className="text-lg font-extrabold leading-snug">{t("easy.listing_image.ask_title")}</h2>
              <p className="mt-1 text-sm leading-snug text-muted-foreground">{t("easy.listing_image.ask_desc")}</p>
            </div>
          </div>
          <Button type="button" size="lg" fullWidth className="mt-4 text-base" onClick={() => create()} data-listing-image-create>
            <Sparkles className="size-5" aria-hidden /> {t("easy.listing_image.create")}
          </Button>
        </>
      ) : null}

      {state === "preset" ? (
        <div className="flex aspect-[3/2] w-full items-center justify-center rounded-lg bg-secondary motion-safe:animate-pulse" aria-busy>
          <Loader2 className="size-7 animate-spin text-muted-foreground" aria-hidden />
          <span className="sr-only">{t("common.labels.loading")}</span>
        </div>
      ) : null}

      {state === "busy" ? (
        <div className="space-y-3">
          <div className="flex aspect-[3/2] w-full items-center justify-center rounded-lg bg-secondary motion-safe:animate-pulse">
            <Loader2 className="size-8 animate-spin text-primary-ink" aria-hidden />
          </div>
          <p className="text-base font-semibold">{t("easy.listing_image.busy")}</p>
          <p className="text-sm text-muted-foreground">{t("easy.listing_image.busy_note")}</p>
        </div>
      ) : null}

      {state === "ready" && value ? (
        <div className="space-y-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- ochiq bucket'dagi tayyor JPEG */}
          <img src={value.url} alt={t("easy.listing_image.done_alt")} width={1536} height={1024} className="aspect-[3/2] w-full rounded-lg border border-border object-cover" data-listing-image-preview />
          <p className="text-base font-semibold text-success">{t("easy.listing_image.ready")}</p>
          {value.preset ? <p className="-mt-2 text-sm text-muted-foreground" data-listing-image-preset>{t("easy.listing_image.preset_note")}</p> : null}
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant="outline" size="lg" className="text-base" onClick={() => create({ unique: true })} data-listing-image-again>
              <RefreshCw className="size-5" aria-hidden /> {t("easy.listing_image.again")}
            </Button>
            <Button type="button" variant="ghost" size="lg" className="text-base" onClick={remove} data-listing-image-remove>
              <ImageOff className="size-5" aria-hidden /> {t("easy.listing_image.remove")}
            </Button>
          </div>
          {/* Google Play: AI natijasi haqida ilova ichidan xabar berish (0092) */}
          <AiReportButton kind="listing_image" content={value.url} />
        </div>
      ) : null}

      {phase.step === "error" ? (
        <div className="space-y-3">
          <p className="text-base">{t(`easy.listing_image.error_${KNOWN.has(phase.code) ? phase.code : "generic"}`)}</p>
          <div className="flex flex-wrap gap-2">
            {RETRY.has(phase.code) ? (
              <Button type="button" variant="outline" className="h-11 text-base" onClick={() => create({ retry: true })} data-listing-image-retry>
                <RotateCcw className="size-5" aria-hidden /> {t("easy.listing_image.retry")}
              </Button>
            ) : phase.code === "moderation" ? (
              <Button type="button" variant="outline" className="h-11 text-base" onClick={() => create({ unique: true })} data-listing-image-again>
                <RefreshCw className="size-5" aria-hidden /> {t("easy.listing_image.again")}
              </Button>
            ) : null}
            <Button type="button" variant="ghost" className="h-11 text-base" onClick={() => setPhase({ step: "idle" })}>
              {value ? t("easy.listing_image.keep") : t("easy.listing_image.skip")}
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
