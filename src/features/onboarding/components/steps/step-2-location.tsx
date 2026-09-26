"use client";

import { useMemo, useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LocateFixed, MapPin, ShieldCheck } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { Constants, type Enums } from "@/types/database.types";
import type { District, Region } from "@/lib/reference";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Chip, ChipGroup, FilterChip } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import { Field, Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import { saveLocation, saveWorkerGeo } from "../../actions";
import { locationSchema, type LocationInput } from "../../schema";
import { WizardFooter, errorMessage, fieldError, multiValue, singleValue, useStepSubmit } from "../wizard-shell";

export interface LocationDraft {
  region_id: string | null;
  district_id: string | null;
  area_hint: string | null;
  remote_preference: Enums<"remote_preference"> | null;
  locations: string[];
  hasGeo: boolean;
}

export function Step2Location({ draft, regions, districts }: { draft: LocationDraft; regions: Region[]; districts: District[] }) {
  const { t, tEnum, name } = useT();
  const { pending, submit } = useStepSubmit();
  const {
    control,
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<LocationInput>({
    resolver: zodResolver(locationSchema),
    defaultValues: {
      region_id: draft.region_id ?? "",
      district_id: draft.district_id ?? "",
      area_hint: draft.area_hint ?? "",
      work_districts: draft.locations,
      remote_preference: draft.remote_preference ?? undefined,
    },
  });
  const regionId = watch("region_id");
  const workDistricts = watch("work_districts");
  const [browseRegion, setBrowseRegion] = useState(draft.region_id ?? regions[0]?.id ?? "");

  const regionOptions = useMemo(() => regions.map((r) => ({ value: r.id, label: name(r) })), [regions, name]);
  const districtOptions = useMemo(() => districts.filter((d) => d.region_id === regionId).map((d) => ({ value: d.id, label: name(d) })), [districts, regionId, name]);
  const browseDistricts = useMemo(() => districts.filter((d) => d.region_id === browseRegion), [districts, browseRegion]);
  const districtById = useMemo(() => new Map(districts.map((d) => [d.id, d])), [districts]);

  const onRegionChange = (id: string) => {
    setValue("region_id", id, { shouldValidate: true });
    setValue("district_id", "");
    if (id) setBrowseRegion(id);
  };
  const onDistrictChange = (id: string) => {
    setValue("district_id", id, { shouldValidate: true });
    if (id && !workDistricts.includes(id)) setValue("work_districts", [...workDistricts, id], { shouldValidate: true });
  };

  return (
    <form noValidate onSubmit={handleSubmit((values) => submit(() => saveLocation(values)))} className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("onboarding.worker.location.region")} htmlFor="region_id" required error={fieldError(t, errors.region_id)}>
          <Controller
            control={control}
            name="region_id"
            render={({ field }) => (
              <Select id="region_id" options={regionOptions} placeholder={t("common.actions.choose")} value={field.value} invalid={!!errors.region_id} onChange={(e) => onRegionChange(e.target.value)} />
            )}
          />
        </Field>
        <Field label={t("onboarding.worker.location.district")} htmlFor="district_id" required error={fieldError(t, errors.district_id)}>
          <Controller
            control={control}
            name="district_id"
            render={({ field }) => (
              <Select
                id="district_id"
                options={districtOptions}
                placeholder={regionId ? t("common.actions.choose") : t("onboarding.worker.location.choose_region_first")}
                value={field.value}
                disabled={!regionId}
                invalid={!!errors.district_id}
                onChange={(e) => onDistrictChange(e.target.value)}
              />
            )}
          />
        </Field>
      </div>

      <Field label={t("onboarding.worker.location.area_hint")} htmlFor="area_hint" hint={t("common.labels.optional")} error={fieldError(t, errors.area_hint)}>
        <Input id="area_hint" placeholder={t("onboarding.worker.location.area_hint_placeholder")} maxLength={120} {...register("area_hint")} />
      </Field>

      <div>
        <Label required>{t("onboarding.worker.location.work_districts")}</Label>
        <p className="-mt-1 mb-3 text-xs text-muted-foreground">{t("onboarding.worker.location.work_districts_hint")}</p>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 scrollbar-none">
          {regions.map((r) => {
            const count = workDistricts.filter((id) => districtById.get(id)?.region_id === r.id).length;
            return (
              <Chip key={r.id} size="sm" selected={browseRegion === r.id} onClick={() => setBrowseRegion(r.id)} className="shrink-0">
                {name(r)}
                {count ? <span className={cn("rounded-full px-1.5 text-[11px]", browseRegion === r.id ? "bg-white/20" : "bg-primary-soft text-primary")}>{count}</span> : null}
              </Chip>
            );
          })}
        </div>
        <Controller
          control={control}
          name="work_districts"
          render={({ field }) => (
            <div className="mt-3 space-y-3">
              <ChipGroup
                multiple
                options={browseDistricts.map((d) => ({ value: d.id, label: name(d) }))}
                value={field.value.filter((id) => districtById.get(id)?.region_id === browseRegion)}
                onChange={(next) => {
                  const others = field.value.filter((id) => districtById.get(id)?.region_id !== browseRegion);
                  field.onChange([...others, ...multiValue(next)]);
                }}
              />
              {field.value.length ? (
                <div className="flex flex-wrap items-center gap-1.5 rounded-xl bg-secondary/60 p-2.5">
                  <span className="mr-1 text-xs text-muted-foreground">{t("common.labels.selected", { count: field.value.length })}:</span>
                  {field.value.map((id) => {
                    const d = districtById.get(id);
                    return d ? (
                      <FilterChip key={id} onRemove={() => field.onChange(field.value.filter((x) => x !== id))}>
                        {name(d)}
                      </FilterChip>
                    ) : null;
                  })}
                </div>
              ) : null}
            </div>
          )}
        />
        {fieldError(t, errors.work_districts) ? (
          <p className="mt-1 text-sm text-destructive" role="alert">
            {fieldError(t, errors.work_districts)}
          </p>
        ) : null}
      </div>

      <Field label={t("onboarding.worker.location.remote")} required error={fieldError(t, errors.remote_preference)}>
        <Controller
          control={control}
          name="remote_preference"
          render={({ field }) => (
            <ChipGroup
              size="lg"
              options={Constants.public.Enums.remote_preference.map((v) => ({ value: v, label: tEnum("remote_preference", v) }))}
              value={field.value ?? null}
              onChange={(v) => field.onChange(singleValue(v))}
            />
          )}
        />
      </Field>

      <GeoCard hasGeo={draft.hasGeo} />

      <WizardFooter step={2} pending={pending} />
    </form>
  );
}

/** Aniq joylashuv (worker_geo): faqat masofa hisoblash uchun, hech kimga ko'rsatilmaydi */
function GeoCard({ hasGeo }: { hasGeo: boolean }) {
  const { t } = useT();
  const [state, setState] = useState<"idle" | "locating" | "saved">(hasGeo ? "saved" : "idle");
  const [, startTransition] = useTransition();

  const detect = () => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      toast.error(t("onboarding.worker.errors.geo_unavailable"));
      return;
    }
    setState("locating");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        startTransition(async () => {
          const res = await saveWorkerGeo({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          if (!res.ok) {
            setState(hasGeo ? "saved" : "idle");
            toast.error(errorMessage(t, res.error));
            return;
          }
          setState("saved");
          toast.success(t("onboarding.worker.location.geo_saved"));
        });
      },
      (err) => {
        setState(hasGeo ? "saved" : "idle");
        toast.error(t(err.code === err.PERMISSION_DENIED ? "onboarding.worker.errors.geo_denied" : "onboarding.worker.errors.geo_unavailable"));
      },
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 },
    );
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
          <MapPin className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold">{t("onboarding.worker.location.geo_title")}</p>
            {state === "saved" ? <Badge variant="success">{t("onboarding.worker.location.geo_saved_badge")}</Badge> : null}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">{t("onboarding.worker.location.geo_desc")}</p>
          <p className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-success" />
            {t("onboarding.worker.location.geo_privacy")}
          </p>
          <Button type="button" variant={state === "saved" ? "outline" : "soft"} size="sm" className="mt-3" onClick={detect} loading={state === "locating"}>
            <LocateFixed className="size-4" />
            {state === "saved" ? t("onboarding.worker.location.geo_update") : t("onboarding.worker.location.geo_detect")}
          </Button>
        </div>
      </div>
    </div>
  );
}
