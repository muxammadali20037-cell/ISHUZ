"use client";

import { useCallback, useState } from "react";
import { useT } from "@/lib/i18n/client";
import { toast } from "@/components/ui/toast";

/** Brauzer geolokatsiyasi: muvaffaqiyatda {lat,lng}, aks holda null (toast bilan) */
export function useGeolocate() {
  const { t } = useT();
  const [locating, setLocating] = useState(false);

  const locate = useCallback(async (): Promise<{ lat: number; lng: number } | null> => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      toast.error(t("workers.search.location_unsupported"));
      return null;
    }
    setLocating(true);
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 }),
      );
      return { lat: Math.round(pos.coords.latitude * 10_000) / 10_000, lng: Math.round(pos.coords.longitude * 10_000) / 10_000 };
    } catch {
      toast.error(t("workers.search.location_denied"));
      return null;
    } finally {
      setLocating(false);
    }
  }, [t]);

  return { locate, locating };
}
