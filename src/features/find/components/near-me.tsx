"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, LocateFixed, Loader2 } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { callAction } from "@/lib/action-call";
import { toast } from "@/components/ui/toast";
import { LocateAsk, nearestDistrict } from "@/components/shared/locate-ask";
import type { District, Region } from "@/lib/reference";
import { cn } from "@/lib/utils";
import { findHref, type FindParams } from "../params";
import { rememberPlace } from "../place-actions";

/** Topilgan tuman → natijalar (kasb tanlanmagan bo'lsa — barcha kasblar); tuman shu qurilmada eslab qolinadi */
function useGoNear(base: FindParams, regions: Region[]) {
  const router = useRouter();
  return async (d: District) => {
    const region = regions.find((r) => r.id === d.region_id);
    if (!region) return false;
    await callAction(() => rememberPlace({ region: region.slug, district: d.id }));
    router.replace(findHref(base, { near: false, any: !base.p, region: region.slug, district: d.id, page: 1 }));
    return true;
  };
}

/** "Yaqin atrofda" (hudud hali noma'lum): joylashuvni aniqlash yoki ro'yxatdan tanlash */
export function NearMe({ base, regions, districts }: { base: FindParams; regions: Region[]; districts: District[] }) {
  const { t } = useT();
  const router = useRouter();
  const go = useGoNear(base, regions);
  return (
    <div className="container-narrow space-y-5 py-5 sm:py-8">
      <Link href="/" className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-border bg-card px-4 text-base font-semibold">
        <ArrowLeft className="size-5" aria-hidden /> {t("easy.wizard.back")}
      </Link>
      <LocateAsk
        heading="h1"
        districts={districts}
        title={base.mode === "workers" ? t("easy.near.title_workers") : t("easy.near.title_jobs")}
        subtitle={t("easy.near.subtitle")}
        onLocated={(d) => void go(d)}
        onManual={() => router.replace(findHref(base, { near: false, any: !base.p, region: null, district: null, page: 1 }))}
      />
    </div>
  );
}

/** Viloyat qadamida: "Joylashuvim bo'yicha" — bir bosishda eng yaqin tuman natijalari */
export function NearMeButton({ base, regions, districts, className }: { base: FindParams; regions: Region[]; districts: District[]; className?: string }) {
  const { t } = useT();
  const go = useGoNear(base, regions);
  const [busy, setBusy] = useState(false);
  const [, start] = useTransition();
  const fail = () => {
    setBusy(false);
    toast.error(t("easy.near.failed"));
  };
  const detect = () => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) return fail();
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const d = nearestDistrict(pos.coords.latitude, pos.coords.longitude, districts);
        if (!d) return fail();
        start(async () => {
          if (!(await go(d))) fail();
        });
      },
      fail,
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 },
    );
  };
  return (
    <button
      type="button"
      onClick={detect}
      disabled={busy}
      aria-busy={busy}
      data-track="near_me"
      className={cn("press flex min-h-14 w-full items-center gap-3 rounded-2xl border-2 border-primary/40 bg-primary-soft/50 px-4 py-3 text-left text-lg font-semibold text-primary hover:bg-primary-soft", className)}
    >
      {busy ? <Loader2 className="size-6 shrink-0 animate-spin" aria-hidden /> : <LocateFixed className="size-6 shrink-0" aria-hidden />}
      <span className="flex-1">{busy ? t("easy.near.locating") : t("easy.near.button")}</span>
    </button>
  );
}
