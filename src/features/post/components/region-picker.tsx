"use client";

import { Check, ChevronRight, Globe2, MapPin } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import type { District, Region } from "@/lib/reference";
import { cn } from "@/lib/utils";
import type { PlaceChoice } from "../types";

/**
 * Hudud: avval viloyat (yoki Toshkent shahri), keyin FAQAT shu viloyatning tuman/shaharlari + "Butun viloyat".
 * GPS shart emas — qo'lda tanlash doim ishlaydi. Vakansiya uchun "Masofadan" tanlovi ham bor.
 */
export function RegionPicker({
  regions,
  districts,
  value,
  onChange,
  allowRemote,
  invalid,
}: {
  regions: Region[];
  districts: District[];
  value: PlaceChoice;
  onChange: (v: PlaceChoice) => void;
  allowRemote?: boolean;
  invalid?: boolean;
}) {
  const { t, name } = useT();
  const region = regions.find((r) => r.id === value.regionId) ?? null;

  if (value.remote) {
    return (
      <div className="space-y-3">
        <SelectedBox icon={<Globe2 className="size-6" />} title={t("easy.location.remote")} subtitle={t("easy.location.remote_desc")} />
        <button type="button" onClick={() => onChange({ regionId: null, districtId: null, districtChosen: false, remote: false })} className={changeBtn}>
          {t("easy.location.other_region")}
        </button>
      </div>
    );
  }

  if (!region) {
    return (
      <div className="space-y-3">
        <p className="text-lg font-semibold">{t("easy.location.pick_region")}</p>
        <ul className={cn("grid gap-2 sm:grid-cols-2", invalid && "rounded-2xl ring-2 ring-destructive/50 ring-offset-2")}>
          {allowRemote ? (
            <li className="sm:col-span-2">
              <button type="button" onClick={() => onChange({ regionId: null, districtId: null, districtChosen: true, remote: true })} className={listBtn(false)}>
                <Globe2 className="size-6 shrink-0 text-primary" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block">{t("easy.location.remote")}</span>
                  <span className="block text-base font-normal text-muted-foreground">{t("easy.location.remote_desc")}</span>
                </span>
                <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
              </button>
            </li>
          ) : null}
          {regions.map((r) => (
            <li key={r.id}>
              <button type="button" onClick={() => onChange({ regionId: r.id, districtId: null, districtChosen: false, remote: false })} className={listBtn(false)}>
                <MapPin className="size-6 shrink-0 text-primary" aria-hidden />
                <span className="min-w-0 flex-1">{name(r)}</span>
                <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  const list = districts.filter((d) => d.region_id === region.id);
  const wholeOn = value.districtChosen && !value.districtId;
  return (
    <div className="space-y-4">
      <SelectedBox icon={<MapPin className="size-6" />} title={name(region)} subtitle={t("easy.location.chosen")} />
      <button type="button" onClick={() => onChange({ regionId: null, districtId: null, districtChosen: false, remote: false })} className={changeBtn}>
        {t("easy.location.other_region")}
      </button>
      <p className="pt-2 text-lg font-semibold">{t("easy.location.pick_district", { region: name(region) })}</p>
      <ul className={cn("grid gap-2 sm:grid-cols-2", invalid && "rounded-2xl ring-2 ring-destructive/50 ring-offset-2")} role="radiogroup" aria-label={t("easy.location.pick_district", { region: name(region) })}>
        <li className="sm:col-span-2">
          <button
            type="button"
            role="radio"
            aria-checked={wholeOn}
            onClick={() => onChange({ ...value, districtId: null, districtChosen: true })}
            className={listBtn(wholeOn)}
          >
            <span className="min-w-0 flex-1">
              <span className="block">{t("easy.location.whole_region")}</span>
              <span className="block text-base font-normal text-muted-foreground">{t("easy.location.whole_region_desc")}</span>
            </span>
            {wholeOn ? <Check className="size-6 shrink-0 text-primary" strokeWidth={3} aria-hidden /> : null}
          </button>
        </li>
        {list.map((d) => {
          const on = value.districtId === d.id;
          return (
            <li key={d.id}>
              <button type="button" role="radio" aria-checked={on} onClick={() => onChange({ ...value, districtId: d.id, districtChosen: true })} className={listBtn(on)}>
                <span className="min-w-0 flex-1">{name(d)}</span>
                {on ? <Check className="size-6 shrink-0 text-primary" strokeWidth={3} aria-hidden /> : null}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const changeBtn = "min-h-12 rounded-xl px-1 text-base font-semibold text-primary underline-offset-4 hover:underline";

function listBtn(on: boolean) {
  return cn(
    "flex min-h-14 w-full items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left text-lg font-semibold transition-colors",
    on ? "border-primary bg-primary-soft" : "border-border bg-card hover:border-primary/50",
  );
}

function SelectedBox({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border-2 border-primary bg-primary-soft/60 p-4">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">{icon}</span>
      <span className="min-w-0">
        <span className="block text-base text-muted-foreground">{subtitle}</span>
        <span className="block text-xl font-bold">{title}</span>
      </span>
    </div>
  );
}

/** Hudud matni: "Toshkent shahri · Chilonzor" / "Toshkent shahri · Butun viloyat" / "Masofadan" */
export function placeLabel(
  place: PlaceChoice,
  regions: Region[],
  districts: District[],
  name: (row: { name_uz: string; name_ru: string; name_en?: string | null; name_oz?: string | null }) => string,
  t: (k: string) => string,
): string {
  if (place.remote) return t("easy.location.remote");
  const r = regions.find((x) => x.id === place.regionId);
  if (!r) return "—";
  const d = districts.find((x) => x.id === place.districtId);
  return `${name(r)} · ${d ? name(d) : t("easy.location.whole_region")}`;
}
