"use client";

import { useId, useMemo, useState } from "react";
import { Laptop } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import type { District, Region } from "@/lib/reference";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { saveRegionPrefs } from "../actions";
import { EXPERIENCE_LEVELS, type ExperienceLevel } from "../prefs";
import { EntrySubmit } from "./entry-client";

/**
 * 06 · Hudud va tajriba: viloyat → tuman (viloyat tanlangach), "masofaviy ham mos" va tajriba (ixtiyoriy).
 * JS'siz ham yuboriladi (tuman tanlovi — viloyat oldindan saqlangan bo'lsa); server tumanni viloyatga mosligini tekshiradi.
 */
export function PlaceStepForm({
  regions,
  districts,
  initial,
}: {
  regions: Region[];
  districts: District[];
  initial: { region: string; district: string; remote: boolean; experience: ExperienceLevel | null };
}) {
  const { t, tEnum, name } = useT();
  const uid = useId();
  const [region, setRegion] = useState(initial.region);
  const [district, setDistrict] = useState(initial.district);
  const [remote, setRemote] = useState(initial.remote);
  const [experience, setExperience] = useState<ExperienceLevel | null>(initial.experience);
  const regionRow = regions.find((r) => r.slug === region) ?? null;
  const regionDistricts = useMemo(() => (regionRow ? districts.filter((d) => d.region_id === regionRow.id) : []), [districts, regionRow]);

  return (
    <form action={saveRegionPrefs} className="flex flex-1 flex-col" data-place-form>
      <div className="mt-6 grid gap-4">
        <div className="grid gap-1.5">
          <label htmlFor={`${uid}-region`} className="text-sm font-semibold">
            {t("welcome.entry.place.region")}
          </label>
          <Select
            id={`${uid}-region`}
            name="region"
            value={region}
            onChange={(e) => {
              setRegion(e.target.value);
              setDistrict("all");
            }}
            options={[{ value: "all", label: t("welcome.entry.place.region_all") }, ...regions.map((r) => ({ value: r.slug, label: name(r) }))]}
          />
        </div>
        {regionRow ? (
          <div className="grid gap-1.5">
            <label htmlFor={`${uid}-district`} className="text-sm font-semibold">
              {t("welcome.entry.place.district")}
            </label>
            <Select
              id={`${uid}-district`}
              name="district"
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
              options={[{ value: "all", label: t("welcome.entry.place.district_all") }, ...regionDistricts.map((d) => ({ value: d.id, label: name(d) }))]}
            />
          </div>
        ) : null}
        <label
          className={cn(
            "press flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl border-2 bg-card px-4 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
            remote ? "border-primary bg-primary-soft" : "border-border hover:border-primary/40",
          )}
        >
          <input type="checkbox" name="remote" value="1" checked={remote} onChange={(e) => setRemote(e.target.checked)} className="size-5 accent-primary" />
          <Laptop className="size-5 shrink-0 text-primary-ink" aria-hidden />
          <span className="text-sm font-semibold leading-snug">{t("welcome.entry.place.remote")}</span>
        </label>
      </div>

      <fieldset className="mt-7">
        <legend className="text-base font-bold">
          {t("welcome.entry.place.experience")} <span className="text-sm font-medium text-muted-foreground">· {t("welcome.entry.place.optional")}</span>
        </legend>
        <div className="mt-3 flex flex-wrap gap-2">
          {EXPERIENCE_LEVELS.map((x) => {
            const on = experience === x;
            return (
              <label
                key={x}
                className={cn(
                  "press inline-flex min-h-11 cursor-pointer items-center rounded-full border px-4 text-sm font-semibold transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
                  on ? "border-primary bg-primary-soft text-primary-ink" : "border-border bg-card hover:border-primary/40",
                )}
              >
                <input type="radio" name="experience" value={x} checked={on} onChange={() => setExperience(x)} className="sr-only" />
                {tEnum("experience_level", x)}
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="flex-1" />
      <div className="sticky bottom-0 z-10 -mx-5 mt-6 bg-background px-5 pb-[max(1rem,var(--safe-bottom))] pt-3">
        <EntrySubmit>{t("welcome.entry.place.finish")}</EntrySubmit>
      </div>
    </form>
  );
}
