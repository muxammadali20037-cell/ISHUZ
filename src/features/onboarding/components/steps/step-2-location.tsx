"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
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
import { toast } from "@/components/ui/toast";
import { Question, QuestionProgress, useQuestionFlow } from "@/components/shared/question-flow";
import { ChoiceList, LocateAsk } from "@/components/shared/locate-ask";
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
    setValue,
    trigger,
    formState: { errors },
  } = useForm<LocationInput>({
    resolver: zodResolver(locationSchema),
    defaultValues: {
      region_id: draft.region_id ?? "",
      district_id: draft.district_id ?? "",
      area_hint: draft.area_hint ?? "",
      work_districts: draft.locations,
      remote_preference: draft.remote_preference ?? "any",
    },
  });
  const regionId = useWatch({ control, name: "region_id" });
  const districtId = useWatch({ control, name: "district_id" });
  const workDistricts = useWatch({ control, name: "work_districts" });
  const [browseRegion, setBrowseRegion] = useState(draft.region_id ?? regions[0]?.id ?? "");

  const regionOptions = useMemo(() => regions.map((r) => ({ value: r.id, label: name(r) })), [regions, name]);
  const districtOptions = useMemo(() => districts.filter((d) => d.region_id === regionId).map((d) => ({ value: d.id, label: name(d) })), [districts, regionId, name]);
  const browseDistricts = useMemo(() => districts.filter((d) => d.region_id === browseRegion), [districts, browseRegion]);
  const districtById = useMemo(() => new Map(districts.map((d) => [d.id, d])), [districts]);

  const flow = useQuestionFlow<LocationInput>(
    [
      // Joylashuv allaqachon ma'lum bo'lsa (qaytgan foydalanuvchi) — so'ralmaydi
      { id: "locate", hidden: !!draft.region_id },
      { id: "region", fields: ["region_id"] },
      { id: "district", fields: ["district_id"] },
      // Sodda onboarding: ish tumanlari (o'z tumani avtomatik), masofaviylik va mo'ljal — keyin profilda
      { id: "work_districts", fields: ["work_districts"], hidden: true },
      { id: "remote", fields: ["remote_preference"], hidden: true },
      { id: "details", fields: ["area_hint"], hidden: true },
    ],
    trigger,
  );

  const [, startGeo] = useTransition();
  // Ish tumanlari savoli yashirin — kamida o'z tumani bo'lsin (aks holda ko'rinmas xato chiqardi)
  useEffect(() => {
    if (districtId && !workDistricts.length) setValue("work_districts", [districtId], { shouldValidate: true });
  }, [districtId, workDistricts.length, setValue]);
  const onRegionChange = (id: string) => {
    if (id !== regionId) setValue("district_id", "");
    setValue("region_id", id, { shouldValidate: true });
    if (id) {
      setBrowseRegion(id);
      flow.advance();
    }
  };
  const onDistrictChange = (id: string) => {
    setValue("district_id", id, { shouldValidate: true });
    if (id && !workDistricts.includes(id))
      setValue("work_districts", [...workDistricts, id], {
        shouldValidate: true,
      });
    if (id) flow.advance();
  };

  return (
    <form noValidate onSubmit={flow.bindSubmit(handleSubmit((values) => submit(() => saveLocation(values)), flow.onInvalid))} className="space-y-6">
      <QuestionProgress flow={flow} />

      <Question show={flow.is("locate")}>
        <LocateAsk
          districts={districts}
          title={t("onboarding.worker.location.where_title")}
          subtitle={t("onboarding.worker.location.where_sub")}
          onLocated={(d, coords) => {
            setValue("region_id", d.region_id, { shouldValidate: true });
            setValue("district_id", d.id, { shouldValidate: true });
            setBrowseRegion(d.region_id);
            if (!workDistricts.includes(d.id)) setValue("work_districts", [...workDistricts, d.id], { shouldValidate: true });
            // Aniq nuqta faqat masofani hisoblash uchun (foydalanuvchi o'zi ruxsat berdi), hech kimga ko'rsatilmaydi
            startGeo(async () => {
              await saveWorkerGeo(coords);
            });
            flow.advance();
          }}
          onManual={() => void flow.next()}
        />
      </Question>

      <Question show={flow.is("region")}>
        <ChoiceList
          title={t("onboarding.worker.location.region")}
          subtitle={regionId ? t("common.locate.confirm_hint") : undefined}
          options={regionOptions}
          value={regionId}
          columns={2}
          onPick={onRegionChange}
        />
        {fieldError(t, errors.region_id) ? <p className="mt-2 text-sm text-destructive" role="alert">{fieldError(t, errors.region_id)}</p> : null}
      </Question>

      <Question show={flow.is("district")}>
        <ChoiceList title={t("onboarding.worker.location.district")} options={districtOptions} value={districtId} columns={2} onPick={onDistrictChange} />
        {fieldError(t, errors.district_id) ? <p className="mt-2 text-sm text-destructive" role="alert">{fieldError(t, errors.district_id)}</p> : null}
      </Question>

      <Question show={flow.is("work_districts")}>
        <Label required className="mb-1 text-xl font-semibold leading-snug sm:text-2xl">
          {t("onboarding.worker.location.work_districts")}
        </Label>
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
                options={browseDistricts.map((d) => ({
                  value: d.id,
                  label: name(d),
                }))}
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
      </Question>

      <Question show={flow.is("remote")}>
        <Field size="lg" label={t("onboarding.worker.location.remote")} required error={fieldError(t, errors.remote_preference)}>
          <Controller
            control={control}
            name="remote_preference"
            render={({ field }) => (
              <ChipGroup
                size="lg"
                options={Constants.public.Enums.remote_preference.map((v) => ({
                  value: v,
                  label: tEnum("remote_preference", v),
                }))}
                value={field.value ?? null}
                onChange={(v) => {
                  const next = singleValue(v);
                  field.onChange(next);
                  if (next) flow.advance();
                }}
              />
            )}
          />
        </Field>
      </Question>

      <Question show={flow.is("details")}>
        <Field size="lg" label={t("onboarding.worker.location.area_hint")} htmlFor="area_hint" hint={t("common.labels.optional")} error={fieldError(t, errors.area_hint)}>
          <Input id="area_hint" placeholder={t("onboarding.worker.location.area_hint_placeholder")} maxLength={120} {...register("area_hint")} />
        </Field>
        <GeoCard hasGeo={draft.hasGeo} />
      </Question>

      <WizardFooter step={2} pending={pending} onBack={flow.isFirst ? undefined : flow.back} continueLabel={flow.isLast ? undefined : t("common.actions.next")} />
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
          const res = await saveWorkerGeo({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
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
