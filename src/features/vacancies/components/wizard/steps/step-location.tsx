"use client";

import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LocateFixed, MapPin, ExternalLink, X, Wifi } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { locationSchema, type LocationInput } from "../../../schema";
import { yandexMapsUrl } from "../../../utils";
import { useSaveStep } from "../use-save-step";
import { WizardFooter } from "../wizard-footer";
import type { StepProps } from "../types";

function round6(n: number) {
  return Math.round(n * 1e6) / 1e6;
}

/** 3-qadam: masofaviy / viloyat / tuman / manzil / koordinata (geolokatsiya yoki tuman markazi) */
export function StepLocation({ mode, vacancy, refs }: StepProps) {
  const { t, name } = useT();
  const saver = useSaveStep(mode, vacancy.id, "location");
  const [locating, setLocating] = useState(false);
  const form = useForm<LocationInput>({
    resolver: zodResolver(locationSchema),
    defaultValues: {
      isRemote: vacancy.is_remote,
      regionId: vacancy.region_id,
      districtId: vacancy.district_id,
      address: vacancy.address,
      lat: vacancy.lat,
      lng: vacancy.lng,
    },
  });
  const isRemote = useWatch({ control: form.control, name: "isRemote" });
  const regionId = useWatch({ control: form.control, name: "regionId" });
  const districtId = useWatch({ control: form.control, name: "districtId" });
  const lat = useWatch({ control: form.control, name: "lat" });
  const lng = useWatch({ control: form.control, name: "lng" });
  const districts = refs.districts.filter((d) => d.region_id === regionId);
  const district = districts.find((d) => d.id === districtId) ?? null;
  const errors = form.formState.errors;

  const locate = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      toast.error(t("vacancies.errors.geolocation_unsupported"));
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        form.setValue("lat", round6(pos.coords.latitude), { shouldValidate: true });
        form.setValue("lng", round6(pos.coords.longitude), { shouldValidate: true });
        setLocating(false);
        toast.success(t("vacancies.toast.location_found"));
      },
      () => {
        setLocating(false);
        toast.error(t("vacancies.errors.geolocation_denied"));
      },
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 60_000 },
    );
  };

  const onSubmit = form.handleSubmit((data) => saver.save({ step: "location", data }));

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <Controller
        control={form.control}
        name="isRemote"
        render={({ field }) => (
          <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-border bg-card p-4 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary-soft/50">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
              <Wifi className="size-5" />
            </span>
            <span className="flex-1">
              <span className="block font-semibold">{t("vacancies.wizard.location.remote")}</span>
              <span className="block text-xs text-muted-foreground">{t("vacancies.wizard.location.remote_desc")}</span>
            </span>
            <Switch checked={field.value} onCheckedChange={field.onChange} aria-label={t("vacancies.wizard.location.remote")} />
          </label>
        )}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("vacancies.wizard.location.region")} htmlFor="region" required={!isRemote} error={errors.regionId?.message ? t(errors.regionId.message) : undefined}>
          <Controller
            control={form.control}
            name="regionId"
            render={({ field }) => (
              <Select
                id="region"
                value={field.value ?? ""}
                invalid={!!errors.regionId}
                placeholder={t("vacancies.wizard.location.region_placeholder")}
                options={refs.regions.map((r) => ({ value: r.id, label: name(r) }))}
                onChange={(e) => {
                  field.onChange(e.target.value || null);
                  form.setValue("districtId", null);
                }}
              />
            )}
          />
        </Field>
        <Field label={t("vacancies.wizard.location.district")} htmlFor="district" hint={t("common.labels.optional")}>
          <Controller
            control={form.control}
            name="districtId"
            render={({ field }) => (
              <Select
                id="district"
                value={field.value ?? ""}
                disabled={!regionId}
                placeholder={t("vacancies.wizard.location.district_placeholder")}
                options={districts.map((d) => ({ value: d.id, label: name(d) }))}
                onChange={(e) => field.onChange(e.target.value || null)}
              />
            )}
          />
        </Field>
      </div>

      <Field label={t("vacancies.wizard.location.address")} htmlFor="address" hint={t("common.labels.optional")} error={errors.address?.message ? t(errors.address.message) : undefined}>
        <Controller
          control={form.control}
          name="address"
          render={({ field }) => <Input id="address" maxLength={200} placeholder={t("vacancies.wizard.location.address_placeholder")} leftIcon={<MapPin />} value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value === "" ? null : e.target.value)} onBlur={field.onBlur} />}
        />
      </Field>

      {!isRemote ? (
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="font-semibold">{t("vacancies.wizard.location.coords")}</div>
          <p className="mt-1 text-xs text-muted-foreground">{t("vacancies.wizard.location.coords_hint")}</p>
          {/* Raqamli koordinata maydonlari yo'q — bitta tugma bilan aniqlanadi */}
          {lat !== null && lng !== null ? (
            <p className="mt-3 flex items-center gap-2 rounded-xl bg-success-soft px-3 py-2 text-sm font-medium text-foreground">
              <MapPin className="size-4 text-success" /> {t("vacancies.wizard.location.coords_set")}
            </p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" variant="soft" onClick={locate} loading={locating}>
              <LocateFixed className="size-4" /> {locating ? t("vacancies.wizard.location.locating") : t("vacancies.actions.get_location")}
            </Button>
            {district?.lat && district.lng ? (
              <Button type="button" variant="outline" size="sm" onClick={() => { form.setValue("lat", district.lat as number, { shouldValidate: true }); form.setValue("lng", district.lng as number, { shouldValidate: true }); }}>
                <MapPin className="size-4" /> {t("vacancies.actions.district_center")}
              </Button>
            ) : null}
            {lat !== null && lng !== null ? (
              <>
                <Button asChild variant="link" size="sm">
                  <a href={yandexMapsUrl(lat, lng)} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="size-4" /> {t("vacancies.actions.open_yandex")}
                  </a>
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => { form.setValue("lat", null, { shouldValidate: true }); form.setValue("lng", null, { shouldValidate: true }); }}>
                  <X className="size-4" /> {t("vacancies.actions.clear_coords")}
                </Button>
              </>
            ) : null}
          </div>
        </div>
      ) : null}

      <WizardFooter mode={mode} step="location" pending={saver.pending} onBack={saver.back} />
    </form>
  );
}
