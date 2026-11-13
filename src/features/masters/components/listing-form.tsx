"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import { CheckCircle2 } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { formatPhoneAsYouType, normalizePhone } from "@/lib/format";
import { callAction } from "@/lib/action-call";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { District, Region } from "@/lib/reference";
import { saveMasterListing } from "../actions";
import { parseServices } from "../schema";
import type { MasterCategory, MasterListingStatus, MyMasterListing } from "../types";
import { CategoryIcon } from "./category-icon";
import { PhotosUpload } from "./photos-upload";

const field =
  "h-12 w-full rounded-xl border border-input bg-background px-3 text-base outline-none focus:border-primary focus:ring-2 focus:ring-ring/25 aria-[invalid=true]:border-destructive";

function Field({
  label,
  id,
  error,
  hint,
  children,
}: {
  label: string;
  id: string;
  error?: string | null;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-base font-semibold">
        {label}
      </label>
      {children}
      {hint ? <p className="text-sm text-muted-foreground">{hint}</p> : null}
      {error ? (
        <p id={`${id}-err`} className="text-sm font-semibold text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

type Errors = Partial<
  Record<
    | "category"
    | "displayName"
    | "title"
    | "description"
    | "phone"
    | "price"
    | "hours"
    | "form",
    string
  >
>;

/**
 * Usta e'loni formasi (yangi va tahrirlash): kategoriya, ism, sarlavha, tavsif, tajriba, qo'shimcha xizmatlar, hudud, telefon va
 * uni ochiq ko'rsatish roziligi, narx yoki "Kelishiladi", ish vaqti, rasmlar. "Moderatsiyaga yuborish" yoki "Qoralama".
 */
export function ListingForm({
  userId,
  categories,
  regions,
  districts,
  initial,
  defaults,
}: {
  userId: string;
  categories: MasterCategory[];
  regions: Region[];
  districts: District[];
  initial: MyMasterListing | null;
  defaults: {
    displayName: string;
    phone: string | null;
    category: string | null;
  };
}) {
  const { t, name } = useT();
  const router = useRouter();
  const [categoryId, setCategoryId] = useState(
    initial?.category_id ??
      categories.find((c) => c.slug === defaults.category)?.id ??
      "",
  );
  const [displayName, setDisplayName] = useState(
    initial?.display_name ?? defaults.displayName,
  );
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [experience, setExperience] = useState(
    String(initial?.experience_years ?? ""),
  );
  const [services, setServices] = useState(
    (initial?.services ?? []).join(", "),
  );
  const [regionId, setRegionId] = useState(initial?.region_id ?? "");
  const [districtId, setDistrictId] = useState(initial?.district_id ?? "");
  const [serviceArea, setServiceArea] = useState(initial?.service_area ?? "");
  const [phone, setPhone] = useState(
    formatPhoneAsYouType(initial?.phone ?? defaults.phone ?? ""),
  );
  const [phonePublic, setPhonePublic] = useState(
    initial?.phone_public ?? false,
  );
  const [negotiable, setNegotiable] = useState(
    initial?.price_negotiable ?? true,
  );
  const [priceFrom, setPriceFrom] = useState(
    initial?.price_from != null ? String(initial.price_from) : "",
  );
  const [priceTo, setPriceTo] = useState(
    initial?.price_to != null ? String(initial.price_to) : "",
  );
  const [workFrom, setWorkFrom] = useState(
    initial?.work_from?.slice(0, 5) ?? "09:00",
  );
  const [workTo, setWorkTo] = useState(
    initial?.work_to?.slice(0, 5) ?? "19:00",
  );
  const [photos, setPhotos] = useState<string[]>(initial?.photos ?? []);
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState<"submit" | "draft" | null>(null);
  const [sent, setSent] = useState<MasterListingStatus | null>(null);

  const regionDistricts = districts.filter((d) => d.region_id === regionId);
  const num = (s: string) =>
    s.replace(/\D/g, "") ? Number(s.replace(/\D/g, "")) : null;

  const validate = (): Errors => {
    const e: Errors = {};
    if (!categoryId) e.category = t("masters.form.errors.required");
    if (displayName.trim().length < 2)
      e.displayName = t("masters.form.errors.required");
    if (title.trim().length < 3) e.title = t("masters.form.errors.title_short");
    if (description.trim().length < 10)
      e.description = t("masters.form.errors.description_short");
    if (!normalizePhone(phone)) e.phone = t("masters.form.errors.phone");
    if (!negotiable) {
      const a = num(priceFrom);
      const b = num(priceTo);
      if (a === null && b === null) e.price = t("masters.form.errors.required");
      else if (a !== null && b !== null && b < a)
        e.price = t("masters.form.errors.price_order");
    }
    if ((workFrom && !workTo) || (!workFrom && workTo))
      e.hours = t("masters.form.errors.required");
    return e;
  };

  const save = async (submit: boolean) => {
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) {
      requestAnimationFrame(() =>
        document
          .querySelector<HTMLElement>("[aria-invalid=true], [data-field-error]")
          ?.focus(),
      );
      return;
    }
    setBusy(submit ? "submit" : "draft");
    const res = await callAction(() =>
      saveMasterListing({
        id: initial?.id ?? null,
        categoryId,
        displayName,
        title,
        description,
        experienceYears: Math.min(60, num(experience) ?? 0),
        services: parseServices(services),
        regionId: regionId || null,
        districtId: districtId || null,
        serviceArea: serviceArea.trim() || null,
        phone: normalizePhone(phone),
        phonePublic,
        priceNegotiable: negotiable,
        priceFrom: negotiable ? null : num(priceFrom),
        priceTo: negotiable ? null : num(priceTo),
        workFrom: workFrom || null,
        workTo: workTo || null,
        photos,
        submit,
      }),
    );
    setBusy(null);
    if (!res.ok || !res.data) {
      setErrors({ form: t(res.ok ? "masters.form.errors.generic" : res.error === "prohibited" ? "masters.form.errors.prohibited" : res.error === "blocked" ? "masters.blocked" : res.error === "rate_limited" ? "masters.form.errors.rate_limited" : "masters.form.errors.generic") });
      return;
    }
    setSent(res.data.status);
    router.refresh();
  };

  if (sent) {
    // haqiqiy holat bo'yicha: moderatsiyaga ketdi / qoralama / (faol yoki yashirin e'londa faqat telefon roziligi o'zgargan) saqlandi
    const [title, desc] =
      sent === "pending_review"
        ? [t("masters.form.sent_title"), t("masters.form.sent_desc")]
        : sent === "draft"
          ? [t("masters.form.draft_title"), t("masters.form.draft_desc")]
          : [t("masters.form.saved_title"), t("masters.form.saved_desc")];
    return (
      <div className="rounded-2xl bg-primary-soft p-6" role="status" data-masters-form-sent={sent}>
        <p className="flex items-center gap-2 text-xl font-bold text-primary-ink">
          <CheckCircle2 className="size-7" aria-hidden /> {title}
        </p>
        <p className="mt-2 text-base">{desc}</p>
        <Button className="mt-4 h-12 text-base" onClick={() => router.push("/ustalar/kabinet")}>
          {t("masters.cab.title")}
        </Button>
      </div>
    );
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void save(true);
  };

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-6"
      noValidate
      data-masters-form
    >
      <fieldset className="space-y-2">
        <legend className="text-base font-semibold">
          {t("masters.form.category")}
        </legend>
        <div
          role="radiogroup"
          aria-label={t("masters.form.category")}
          aria-invalid={!!errors.category || undefined}
          className="grid grid-cols-2 gap-2 sm:grid-cols-3"
        >
          {categories.map((c) => {
            const on = c.id === categoryId;
            return (
              <button
                key={c.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setCategoryId(c.id)}
                className={cn(
                  "press flex min-h-12 items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm font-semibold",
                  on
                    ? "border-primary bg-primary-soft text-primary-ink"
                    : "border-border bg-card hover:border-primary/50",
                )}
              >
                <CategoryIcon icon={c.icon} className="size-5 shrink-0" />{" "}
                {name(c)}
              </button>
            );
          })}
        </div>
        {errors.category ? (
          <p
            className="text-sm font-semibold text-destructive"
            data-field-error
            tabIndex={-1}
          >
            {errors.category}
          </p>
        ) : null}
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label={t("masters.form.display_name")}
          id="m-name"
          error={errors.displayName}
        >
          <input
            id="m-name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value.slice(0, 60))}
            aria-invalid={!!errors.displayName}
            className={field}
            autoComplete="name"
          />
        </Field>
        <Field label={t("masters.form.experience")} id="m-exp">
          <input
            id="m-exp"
            value={experience}
            onChange={(e) =>
              setExperience(e.target.value.replace(/\D/g, "").slice(0, 2))
            }
            inputMode="numeric"
            className={field}
            placeholder="0"
          />
        </Field>
      </div>

      <Field label={t("masters.form.title")} id="m-title" error={errors.title}>
        <input
          id="m-title"
          value={title}
          onChange={(e) => setTitle(e.target.value.slice(0, 120))}
          aria-invalid={!!errors.title}
          placeholder={t("masters.form.title_ph")}
          className={field}
        />
      </Field>

      <Field
        label={t("masters.form.description")}
        id="m-desc"
        error={errors.description}
      >
        <textarea
          id="m-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value.slice(0, 3000))}
          rows={5}
          aria-invalid={!!errors.description}
          placeholder={t("masters.form.description_ph")}
          className={cn(field, "h-auto py-2.5")}
        />
      </Field>

      <Field
        label={t("masters.form.services")}
        id="m-services"
        hint={t("masters.form.services_ph")}
      >
        <input
          id="m-services"
          value={services}
          onChange={(e) => setServices(e.target.value.slice(0, 500))}
          className={field}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("masters.form.region")} id="m-region">
          <select
            id="m-region"
            value={regionId}
            onChange={(e) => {
              setRegionId(e.target.value);
              setDistrictId("");
            }}
            className={field}
          >
            <option value="">{t("masters.detail.whole_country")}</option>
            {regions.map((r) => (
              <option key={r.id} value={r.id}>
                {name(r)}
              </option>
            ))}
          </select>
        </Field>
        {regionDistricts.length ? (
          <Field label={t("masters.form.district")} id="m-district">
            <select
              id="m-district"
              value={districtId}
              onChange={(e) => setDistrictId(e.target.value)}
              className={field}
            >
              <option value="">{t("masters.form.whole_region")}</option>
              {regionDistricts.map((d) => (
                <option key={d.id} value={d.id}>
                  {name(d)}
                </option>
              ))}
            </select>
          </Field>
        ) : null}
      </div>
      <Field label={t("masters.form.service_area")} id="m-area">
        <input
          id="m-area"
          value={serviceArea}
          onChange={(e) => setServiceArea(e.target.value.slice(0, 200))}
          placeholder={t("masters.form.service_area_ph")}
          className={field}
        />
      </Field>

      <div className="grid gap-3 rounded-2xl border border-border bg-card p-4">
        <Field
          label={t("masters.form.phone")}
          id="m-phone"
          error={errors.phone}
        >
          <input
            id="m-phone"
            value={phone}
            onChange={(e) => setPhone(formatPhoneAsYouType(e.target.value))}
            inputMode="tel"
            autoComplete="tel"
            placeholder="+998 90 123 45 67"
            aria-invalid={!!errors.phone}
            className={field}
          />
        </Field>
        <label className="flex min-h-11 cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={phonePublic}
            onChange={(e) => setPhonePublic(e.target.checked)}
            className="mt-1 size-5 accent-[var(--primary)]"
            data-masters-phone-consent
          />
          <span>
            <span className="block text-base font-semibold">
              {t("masters.form.phone_public")}
            </span>
            <span className="block text-sm text-muted-foreground">
              {t("masters.form.phone_public_desc")}
            </span>
          </span>
        </label>
      </div>

      <fieldset className="grid gap-3">
        <legend className="text-base font-semibold">
          {t("masters.form.price")}
        </legend>
        <label className="flex min-h-11 cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            checked={negotiable}
            onChange={(e) => setNegotiable(e.target.checked)}
            className="size-5 accent-[var(--primary)]"
          />
          <span className="text-base">
            {t("masters.form.price_negotiable")}
          </span>
        </label>
        {!negotiable ? (
          <div className="grid grid-cols-2 gap-3">
            <input
              aria-label={`${t("masters.form.price")} ${t("masters.form.price_from")}`}
              value={priceFrom}
              onChange={(e) =>
                setPriceFrom(e.target.value.replace(/\D/g, "").slice(0, 10))
              }
              inputMode="numeric"
              placeholder={t("masters.form.price_from")}
              aria-invalid={!!errors.price}
              className={field}
            />
            <input
              aria-label={`${t("masters.form.price")} ${t("masters.form.price_to")}`}
              value={priceTo}
              onChange={(e) =>
                setPriceTo(e.target.value.replace(/\D/g, "").slice(0, 10))
              }
              inputMode="numeric"
              placeholder={t("masters.form.price_to")}
              aria-invalid={!!errors.price}
              className={field}
            />
          </div>
        ) : null}
        {errors.price ? (
          <p className="text-sm font-semibold text-destructive">
            {errors.price}
          </p>
        ) : null}
      </fieldset>

      <fieldset className="grid gap-2">
        <legend className="text-base font-semibold">
          {t("masters.form.hours")}
        </legend>
        <div className="grid grid-cols-2 gap-3">
          <input
            type="time"
            aria-label={`${t("masters.form.hours")} ${t("masters.form.hours_from")}`}
            value={workFrom}
            onChange={(e) => setWorkFrom(e.target.value)}
            className={field}
          />
          <input
            type="time"
            aria-label={`${t("masters.form.hours")} ${t("masters.form.hours_to")}`}
            value={workTo}
            onChange={(e) => setWorkTo(e.target.value)}
            className={field}
          />
        </div>
        {errors.hours ? (
          <p className="text-sm font-semibold text-destructive">
            {errors.hours}
          </p>
        ) : null}
      </fieldset>

      <div className="grid gap-1.5">
        <p className="text-base font-semibold">{t("masters.form.photos")}</p>
        <p className="text-sm text-muted-foreground">
          {t("masters.form.photos_hint")}
        </p>
        <PhotosUpload userId={userId} value={photos} onChange={setPhotos} />
      </div>

      {errors.form ? (
        <p
          role="alert"
          className="rounded-xl bg-destructive-soft px-4 py-3 font-semibold text-destructive"
        >
          {errors.form}
        </p>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          type="submit"
          size="lg"
          loading={busy === "submit"}
          disabled={!!busy}
          className="text-base"
          data-masters-submit
        >
          {busy === "submit"
            ? t("masters.form.saving")
            : t("masters.form.submit")}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="lg"
          loading={busy === "draft"}
          disabled={!!busy}
          onClick={() => void save(false)}
          className="bg-card text-base"
        >
          {t("masters.form.save_draft")}
        </Button>
      </div>
    </form>
  );
}
