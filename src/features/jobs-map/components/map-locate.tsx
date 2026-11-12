"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, LocateFixed } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";
import { callAction } from "@/lib/action-call";
import { nearestDistrict } from "@/components/shared/locate-ask";
import { rememberPlace } from "@/features/find/place-actions";

interface D {
  id: string;
  region_id: string;
  lat: number | null;
  lng: number | null;
}

/**
 * "Joylashuvim bo'yicha": brauzer joylashuvni beradi → eng yaqin tuman shu qurilmada topiladi → /jobs/xarita?region=…&district=….
 * Koordinata serverga yuborilmaydi va saqlanmaydi (faqat tuman — "Yaqin atrofda" bilan bir xil qoida).
 */
export function MapLocate({ districts, regions }: { districts: D[]; regions: { id: string; slug: string }[] }) {
  const { t } = useT();
  const router = useRouter();
  const [state, setState] = useState<"idle" | "busy" | "failed">("idle");
  const detect = () => {
    if (!("geolocation" in navigator)) return setState("failed");
    setState("busy");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const d = nearestDistrict(pos.coords.latitude, pos.coords.longitude, districts);
        const region = d ? regions.find((r) => r.id === d.region_id) : null;
        if (!d || !region) return setState("failed");
        await callAction(() => rememberPlace({ region: region.slug, district: d.id }));
        setState("idle");
        router.push(`/jobs/xarita?region=${encodeURIComponent(region.slug)}&district=${encodeURIComponent(d.id)}`);
      },
      () => setState("failed"),
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 },
    );
  };
  return (
    <div className="space-y-1.5">
      <Button type="button" onClick={detect} disabled={state === "busy"} className="h-12 px-5 text-base" data-map-locate>
        {state === "busy" ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <LocateFixed className="size-5" aria-hidden />}
        {state === "busy" ? t("map.locating") : t("map.locate")}
      </Button>
      {state === "failed" ? (
        <p role="alert" className="text-sm font-semibold text-destructive">
          {t("map.locate_failed")}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">{t("map.locate_note")}</p>
      )}
    </div>
  );
}
