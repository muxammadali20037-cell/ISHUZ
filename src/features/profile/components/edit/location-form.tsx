"use client";

import { useMemo, useState } from "react";
import { LocateFixed, MapPinCheck, X } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import type { District, Region } from "@/lib/reference";
import { Button } from "@/components/ui/button";
import { ChipGroup, FilterChip } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import { Constants, type Enums } from "@/types/database.types";
import { updateLocation } from "../../actions";
import { MAX_WORK_DISTRICTS } from "../../schema";
import { useAction } from "../use-action";
import { EditSectionCard } from "./section-card";

type Geo = { lat: number; lng: number } | null;

export function LocationForm({
  regions,
  districts,
  initial,
}: {
  regions: Region[];
  districts: District[];
  initial: { region_id: string | null; district_id: string | null; area_hint: string | null; remote_preference: Enums<"remote_preference">; work_district_ids: string[]; geo: Geo };
}) {
  const { t, tEnum, name } = useT();
  const { pending, run } = useAction();
  const [regionId, setRegionId] = useState(initial.region_id ?? "");
  const [districtId, setDistrictId] = useState(initial.district_id ?? "");
  const [areaHint, setAreaHint] = useState(initial.area_hint ?? "");
  const [remote, setRemote] = useState<Enums<"remote_preference">>(initial.remote_preference);
  const [workIds, setWorkIds] = useState<string[]>(initial.work_district_ids);
  const [browseRegion, setBrowseRegion] = useState(initial.region_id ?? regions[0]?.id ?? "");
  const [geo, setGeo] = useState<Geo>(initial.geo);
  const [locating, setLocating] = useState(false);

  const regionOptions = useMemo(() => regions.map((r) => ({ value: r.id, label: name(r) })), [regions, name]);
  const homeDistricts = useMemo(() => districts.filter((d) => d.region_id === regionId), [districts, regionId]);
  const browseDistricts = useMemo(() => districts.filter((d) => d.region_id === browseRegion), [districts, browseRegion]);
  const byId = useMemo(() => new Map(districts.map((d) => [d.id, d])), [districts]);

  const changeRegion = (id: string) => {
    setRegionId(id);
    setDistrictId("");
    if (id) setBrowseRegion(id);
  };

  const toggleWork = (next: string | string[] | null) => {
    const ids = Array.isArray(next) ? next : next ? [next] : [];
    // boshqa viloyatlardan tanlanganlar saqlanadi
    const others = workIds.filter((id) => byId.get(id)?.region_id !== browseRegion);
    const merged = [...others, ...ids];
    if (merged.length > MAX_WORK_DISTRICTS) {
      toast.error(t("common.errors.max_length", { max: MAX_WORK_DISTRICTS }));
      return;
    }
    setWorkIds(merged);
  };

  const detect = () => {
    if (!("geolocation" in navigator)) {
      toast.error(t("profile.errors.geo_unsupported"));
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeo({ lat: Number(pos.coords.latitude.toFixed(6)), lng: Number(pos.coords.longitude.toFixed(6)) });
        setLocating(false);
      },
      () => {
        toast.error(t("profile.errors.geo_denied"));
        setLocating(false);
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 },
    );
  };

  const save = () =>
    run(() =>
      updateLocation({
        region_id: regionId || null,
        district_id: districtId || null,
        area_hint: areaHint,
        work_district_ids: workIds,
        remote_preference: remote,
        geo,
      }),
    );

  return (
    <EditSectionCard
      id="location"
      title={t("profile.sections.location")}
      footer={
        <Button type="button" onClick={save} loading={pending}>
          {t("common.actions.save")}
        </Button>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("profile.labels.region")} htmlFor="region">
          <Select id="region" placeholder={t("profile.labels.select_placeholder")} options={regionOptions} value={regionId} onChange={(e) => changeRegion(e.target.value)} />
        </Field>
        <Field label={t("profile.labels.district")} htmlFor="district">
          <Select
            id="district"
            placeholder={t("profile.labels.select_placeholder")}
            options={homeDistricts.map((d) => ({ value: d.id, label: name(d) }))}
            value={districtId}
            onChange={(e) => setDistrictId(e.target.value)}
            disabled={!regionId}
          />
        </Field>
        <Field label={t("profile.labels.area_hint")} htmlFor="area_hint" hint={t("profile.labels.optional")} className="sm:col-span-2">
          <Input id="area_hint" maxLength={120} placeholder={t("profile.labels.area_hint_placeholder")} value={areaHint} onChange={(e) => setAreaHint(e.target.value)} />
        </Field>
      </div>

      <Field label={t("profile.labels.remote")}>
        <ChipGroup
          size="sm"
          options={Constants.public.Enums.remote_preference.map((v) => ({ value: v, label: tEnum("remote_preference", v) }))}
          value={remote}
          onChange={(v) => v && !Array.isArray(v) && setRemote(v)}
        />
      </Field>

      <Field label={t("profile.labels.work_districts")} description={t("profile.labels.work_districts_hint")}>
        {workIds.length ? (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {workIds.map((id) => (
              <FilterChip key={id} onRemove={() => setWorkIds(workIds.filter((w) => w !== id))}>
                {name(byId.get(id)) || "…"}
              </FilterChip>
            ))}
          </div>
        ) : null}
        <Select aria-label={t("profile.labels.region")} options={regionOptions} value={browseRegion} onChange={(e) => setBrowseRegion(e.target.value)} className="mb-2" />
        <ChipGroup
          multiple
          size="sm"
          options={browseDistricts.map((d) => ({ value: d.id, label: name(d) }))}
          value={workIds.filter((id) => byId.get(id)?.region_id === browseRegion)}
          onChange={toggleWork}
        />
      </Field>

      <Field label={t("profile.labels.geo")} description={t("profile.labels.geo_hint")}>
        <div className="flex flex-wrap items-center gap-2">
          {geo ? (
            <>
              <span className="inline-flex h-10 items-center gap-1.5 rounded-full bg-success-soft px-3 text-sm font-medium text-success">
                <MapPinCheck className="size-4" /> {t("profile.labels.geo_detected")}
              </span>
              <Button type="button" variant="ghost" size="sm" onClick={() => setGeo(null)}>
                <X className="size-4" /> {t("profile.labels.geo_clear")}
              </Button>
            </>
          ) : (
            <Button type="button" variant="outline" size="sm" onClick={detect} loading={locating}>
              <LocateFixed className="size-4" /> {t("profile.labels.geo_detect")}
            </Button>
          )}
        </div>
      </Field>
    </EditSectionCard>
  );
}
