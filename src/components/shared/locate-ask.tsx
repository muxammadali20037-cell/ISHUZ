"use client";

import { useState } from "react";
import { Check, LocateFixed, MapPin, PencilLine } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface GeoDistrict {
  id: string;
  region_id: string;
  lat?: number | null;
  lng?: number | null;
}

/** Eng yaqin tuman/shahar (koordinatali yozuvlar orasidan). 80 km dan uzoq bo'lsa — topilmadi (O'zbekistondan tashqari). */
export function nearestDistrict<D extends GeoDistrict>(lat: number, lng: number, districts: D[]): D | null {
  const rad = (x: number) => (x * Math.PI) / 180;
  let best: D | null = null;
  let bestKm = Infinity;
  for (const d of districts) {
    if (d.lat == null || d.lng == null) continue;
    const dLat = rad(d.lat - lat);
    const dLng = rad(d.lng - lng);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat)) * Math.cos(rad(d.lat)) * Math.sin(dLng / 2) ** 2;
    const km = 2 * 6371 * Math.asin(Math.sqrt(a));
    if (km < bestKm) {
      bestKm = km;
      best = d;
    }
  }
  return bestKm <= 80 ? best : null;
}

/**
 * "Joylashuvni aniqlaymizmi?" — bitta katta savol. Ruxsat berilsa eng yaqin viloyat/tuman topiladi va keyingi
 * savollar oldindan belgilanadi (foydalanuvchi faqat tasdiqlaydi). Rad etilsa ham to'xtamaydi — qo'lda tanlaydi.
 * Koordinata hech qayerga yashirin saqlanmaydi: faqat hududni topish uchun ishlatiladi.
 */
export function LocateAsk<D extends GeoDistrict>({
  districts,
  title,
  subtitle,
  onLocated,
  onManual,
}: {
  districts: D[];
  title: string;
  subtitle?: string;
  onLocated: (district: D, coords: { lat: number; lng: number }) => void;
  onManual: () => void;
}) {
  const { t } = useT();
  const [state, setState] = useState<"idle" | "locating" | "failed">("idle");

  const detect = () => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setState("failed");
      return;
    }
    setState("locating");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        const d = nearestDistrict(coords.lat, coords.lng, districts);
        if (!d) {
          setState("failed");
          return;
        }
        setState("idle");
        onLocated(d, coords);
      },
      () => setState("failed"),
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 },
    );
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-extrabold leading-tight tracking-tight">{title}</h2>
        {subtitle ? <p className="mt-1 text-muted-foreground">{subtitle}</p> : null}
      </div>
      <div className="flex flex-col items-center rounded-3xl border border-border bg-card px-5 py-8 text-center">
        <span className="flex size-16 items-center justify-center rounded-2xl bg-primary-soft text-primary">
          <MapPin className="size-8" />
        </span>
        <p className="mt-4 max-w-xs text-sm text-muted-foreground">{t("common.locate.privacy")}</p>
        {state === "failed" ? (
          <p className="mt-3 rounded-xl bg-warning-soft px-3 py-2 text-sm text-foreground" role="status">
            {t("common.locate.failed")}
          </p>
        ) : null}
      </div>
      <div className="space-y-2">
        <Button type="button" size="lg" className="h-14 w-full text-base" onClick={detect} loading={state === "locating"}>
          <LocateFixed className="size-5" /> {t("common.locate.detect")}
        </Button>
        <Button type="button" size="lg" variant="outline" className="h-14 w-full text-base" onClick={onManual}>
          <PencilLine className="size-5" /> {t("common.locate.manual")}
        </Button>
      </div>
    </div>
  );
}

/** Katta bosiladigan ro'yxat (viloyat, tuman): bosildi — tanlandi, ilova keyingisiga o'tadi */
export function ChoiceList({
  options,
  value,
  onPick,
  title,
  subtitle,
  columns = 1,
}: {
  options: { value: string; label: string; hint?: string }[];
  value: string | null | undefined;
  onPick: (value: string) => void;
  title: string;
  subtitle?: string;
  columns?: 1 | 2;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-extrabold leading-tight tracking-tight">{title}</h2>
        {subtitle ? <p className="mt-1 text-muted-foreground">{subtitle}</p> : null}
      </div>
      <div className={cn("grid gap-2", columns === 2 && "sm:grid-cols-2")} role="listbox" aria-label={title}>
        {options.map((o) => {
          const selected = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              role="option"
              aria-selected={selected}
              onClick={() => onPick(o.value)}
              className={cn(
                "flex min-h-14 w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left text-base font-medium transition-colors",
                selected ? "border-primary bg-primary-soft text-foreground" : "border-border bg-card hover:border-primary/50",
              )}
            >
              <span className="min-w-0">
                <span className="block">{o.label}</span>
                {o.hint ? <span className="block text-xs font-normal text-muted-foreground">{o.hint}</span> : null}
              </span>
              {selected ? <Check className="size-5 shrink-0 text-primary" /> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
