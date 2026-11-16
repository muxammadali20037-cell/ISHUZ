"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Check, ChevronLeft, Clock3, Phone, Plus } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { callAction } from "@/lib/action-call";
import { normalizePhone } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { District, Region } from "@/lib/reference";
import { PhoneInput } from "@/features/post/components/inputs";
import { publishMasterQuick } from "../actions";
import { masterServiceKeys } from "../services";
import { MASTER_SERVICES_MAX, type MasterCategory } from "../types";
import { CategoryIcon } from "./category-icon";
import { PhotosUpload } from "./photos-upload";

/**
 * Usta e'loni — oynama-oyna (ega, 2026-11-17): 1) kategoriya (katta plitkalar) → 2) xizmat(lar) → 3) ism-familiya →
 * 4) hudud va telefon → 5) ish namunalari (rasm) → "E'lon joylash". Narx va ish vaqti so'ralmaydi. Joylash — darhol
 * avtomatik tekshiruv bilan; toza bo'lsa — kategoriya sahifasiga ("E'loningiz joylandi").
 */

const TOTAL = 5;

type Errors = Partial<Record<"category" | "services" | "firstName" | "region" | "phone" | "form", string>>;

export function MasterWizard({
  userId,
  categories,
  regions,
  districts,
  defaults,
}: {
  userId: string;
  categories: MasterCategory[];
  regions: Region[];
  districts: District[];
  defaults: { firstName: string; lastName: string; phone: string | null; category: string | null };
}) {
  const { t, name } = useT();
  const router = useRouter();
  const preset = categories.find((c) => c.slug === defaults.category) ?? null;
  const [step, setStep] = useState(preset ? 2 : 1);
  const [categoryId, setCategoryId] = useState(preset?.id ?? "");
  const [services, setServices] = useState<string[]>([]);
  const [other, setOther] = useState("");
  const [firstName, setFirstName] = useState(defaults.firstName);
  const [lastName, setLastName] = useState(defaults.lastName);
  const [regionId, setRegionId] = useState("");
  const [districtId, setDistrictId] = useState("");
  const [phone, setPhone] = useState(defaults.phone ?? "+998 ");
  const [photos, setPhotos] = useState<string[]>([]);
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [review, setReview] = useState(false);

  const category = categories.find((c) => c.id === categoryId) ?? null;
  const catalog = category ? masterServiceKeys(category.slug).map((k) => t(`masters.svc.${category.slug}.${k}`)) : [];
  // ro'yxatda yo'q, o'zi yozgan xizmatlar ham tanlanganlar qatorida ko'rinadi
  const shown = [...catalog, ...services.filter((s) => !catalog.includes(s))];
  const regionDistricts = districts.filter((d) => d.region_id === regionId);

  const go = (n: number) => {
    setErrors({});
    setStep(n);
    window.scrollTo({ top: 0 });
  };

  const toggle = (s: string) =>
    setServices((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : cur.length < MASTER_SERVICES_MAX ? [...cur, s] : cur));

  const addOther = () => {
    const s = other.replace(/\s+/g, " ").trim().slice(0, 40);
    if (s.length < 2) return;
    if (!services.includes(s) && services.length < MASTER_SERVICES_MAX) setServices([...services, s]);
    setOther("");
  };

  const check = (n: number): Errors => {
    const e: Errors = {};
    if (n === 1 && !categoryId) e.category = t("masters.wizard.need_category");
    if (n === 2 && !services.length && other.trim().length < 2) e.services = t("masters.wizard.need_service");
    if (n === 3 && firstName.trim().length < 2) e.firstName = t("masters.wizard.need_name");
    if (n === 4) {
      if (!regionId) e.region = t("masters.wizard.need_region");
      if (!normalizePhone(phone)) e.phone = t("masters.wizard.need_phone");
    }
    return e;
  };

  const next = () => {
    if (step === 2 && other.trim().length >= 2) addOther();
    const e = check(step);
    if (Object.keys(e).length) return setErrors(e);
    go(step + 1);
  };

  const publish = async () => {
    for (const n of [1, 2, 3, 4]) {
      const e = check(n);
      if (Object.keys(e).length) {
        go(n);
        setErrors(e);
        return;
      }
    }
    setBusy(true);
    setErrors({});
    const res = await callAction(() =>
      publishMasterQuick({
        categoryId,
        services,
        firstName,
        lastName,
        regionId,
        districtId: districtId || null,
        phone: normalizePhone(phone),
        photos,
      }),
    );
    if (!res.ok || !res.data) {
      setBusy(false);
      const code = res.ok ? "generic" : res.error;
      const key =
        code === "prohibited"
          ? "masters.form.errors.prohibited"
          : code === "blocked"
            ? "masters.blocked"
            : code === "rate_limited"
              ? "masters.form.errors.rate_limited"
              : "masters.form.errors.generic";
      setErrors({ form: t(key) });
      return;
    }
    if (res.data.status === "active") {
      router.push(`/ustalar/qidiruv?k=${encodeURIComponent(res.data.categorySlug)}&joylandi=1`);
      return;
    }
    setBusy(false);
    setReview(true);
  };

  if (review) {
    return (
      <div className="rounded-2xl border-2 border-primary/40 bg-primary-soft/60 p-6 text-center" role="status" data-master-wizard-review>
        <Clock3 className="mx-auto size-14 text-primary-ink" aria-hidden />
        <h2 className="mt-3 text-2xl font-extrabold">{t("masters.wizard.review_title")}</h2>
        <p className="mx-auto mt-2 max-w-md text-base text-foreground/80">{t("masters.wizard.review_desc")}</p>
        <Button className="mt-5 h-12 text-base" onClick={() => router.push("/ustalar/kabinet")}>
          {t("masters.wizard.to_cabinet")}
        </Button>
      </div>
    );
  }

  const titles = ["", t("masters.wizard.q_category"), t("masters.wizard.q_service"), t("masters.wizard.q_name"), t("masters.wizard.q_place"), t("masters.wizard.q_photos")];
  const descs = ["", t("masters.wizard.q_category_desc"), t("masters.wizard.q_service_desc"), "", "", t("masters.wizard.q_photos_desc")];
  const label = "text-base font-bold";
  const err = (m?: string) =>
    m ? (
      <p className="text-sm font-semibold text-destructive" role="alert">
        {m}
      </p>
    ) : null;

  let body: ReactNode = null;
  if (step === 1) {
    body = (
      <div role="radiogroup" aria-label={titles[1]} className="grid grid-cols-2 gap-3 sm:grid-cols-3" data-master-wizard-categories>
        {categories.map((c) => {
          const on = c.id === categoryId;
          return (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => {
                if (c.id !== categoryId) setServices([]);
                setCategoryId(c.id);
                go(2);
              }}
              className={cn(
                "press flex min-h-28 flex-col items-start justify-between gap-3 rounded-2xl border-2 p-4 text-left text-base font-bold leading-snug",
                on ? "border-primary bg-primary-soft text-primary-ink" : "border-border bg-card hover:border-primary/50",
              )}
              data-category={c.slug}
            >
              <span className="flex size-11 items-center justify-center rounded-xl bg-primary-soft text-primary-ink" aria-hidden>
                <CategoryIcon icon={c.icon} className="size-6" />
              </span>
              <span className="[overflow-wrap:anywhere]">{name(c)}</span>
            </button>
          );
        })}
      </div>
    );
  } else if (step === 2) {
    body = (
      <div className="space-y-5">
        {category ? (
          <p className="inline-flex items-center gap-2 rounded-full bg-primary-soft px-3 py-1.5 text-sm font-bold text-primary-ink">
            <CategoryIcon icon={category.icon} className="size-4" /> {name(category)}
          </p>
        ) : null}
        {shown.length ? (
          <div className="flex flex-wrap gap-2" role="group" aria-label={titles[2]} data-master-wizard-services>
            {shown.map((s) => {
              const on = services.includes(s);
              return (
                <button
                  key={s}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(s)}
                  className={cn(
                    "press inline-flex min-h-12 items-center gap-2 rounded-full border-2 px-4 text-base font-semibold",
                    on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:border-primary/50",
                  )}
                  data-service
                >
                  {on ? <Check className="size-4" aria-hidden /> : null}
                  {s}
                </button>
              );
            })}
          </div>
        ) : null}
        <div className="space-y-1.5">
          <label htmlFor="mw-other" className={label}>
            {t("masters.wizard.other_service")}
          </label>
          <div className="flex gap-2">
            <Input
              id="mw-other"
              value={other}
              onChange={(e) => setOther(e.target.value.slice(0, 40))}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addOther();
                }
              }}
              placeholder={t("masters.wizard.other_placeholder")}
              className="min-w-0 flex-1"
              data-master-wizard-other
            />
            <Button type="button" variant="outline" className="h-11 shrink-0 text-base" onClick={addOther} data-master-wizard-add>
              <Plus className="size-5" aria-hidden /> {t("masters.wizard.add")}
            </Button>
          </div>
        </div>
        {err(errors.services)}
      </div>
    );
  } else if (step === 3) {
    body = (
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="mw-first" className={label}>
            {t("masters.wizard.first_name")}
          </label>
          <Input id="mw-first" value={firstName} onChange={(e) => setFirstName(e.target.value.slice(0, 40))} autoComplete="given-name" invalid={!!errors.firstName} />
          {err(errors.firstName)}
        </div>
        <div className="space-y-1.5">
          <label htmlFor="mw-last" className={label}>
            {t("masters.wizard.last_name")} <span className="text-sm font-normal text-muted-foreground">({t("masters.wizard.optional")})</span>
          </label>
          <Input id="mw-last" value={lastName} onChange={(e) => setLastName(e.target.value.slice(0, 40))} autoComplete="family-name" />
        </div>
      </div>
    );
  } else if (step === 4) {
    body = (
      <div className="space-y-5">
        <div className="space-y-1.5">
          <label htmlFor="mw-region" className={label}>
            {t("masters.wizard.region")}
          </label>
          <Select
            id="mw-region"
            value={regionId}
            onChange={(e) => {
              setRegionId(e.target.value);
              setDistrictId("");
            }}
            options={regions.map((r) => ({ value: r.id, label: name(r) }))}
            placeholder={t("masters.wizard.region_pick")}
            invalid={!!errors.region}
          />
          {err(errors.region)}
        </div>
        {regionDistricts.length ? (
          <div className="space-y-1.5">
            <label htmlFor="mw-district" className={label}>
              {t("masters.wizard.district")}
            </label>
            <Select
              id="mw-district"
              value={districtId}
              onChange={(e) => setDistrictId(e.target.value)}
              options={[{ value: "", label: t("masters.wizard.district_any") }, ...regionDistricts.map((d) => ({ value: d.id, label: name(d) }))]}
            />
          </div>
        ) : null}
        <div className="space-y-1.5">
          <label htmlFor="mw-phone" className={label}>
            {t("masters.wizard.phone")}
          </label>
          <PhoneInput id="mw-phone" value={phone} onChange={setPhone} invalid={!!errors.phone} describedBy="mw-phone-note" />
          <p id="mw-phone-note" className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Phone className="size-4 shrink-0" aria-hidden /> {t("masters.wizard.phone_note")}
          </p>
          {err(errors.phone)}
        </div>
      </div>
    );
  } else {
    body = <PhotosUpload userId={userId} value={photos} onChange={setPhotos} />;
  }

  return (
    <div className="space-y-5" data-master-wizard data-step={step}>
      <div className="flex items-center gap-3">
        {step > 1 ? (
          <button
            type="button"
            onClick={() => go(step - 1)}
            disabled={busy}
            aria-label={t("masters.wizard.back")}
            className="press flex size-11 shrink-0 items-center justify-center rounded-xl border border-border bg-card hover:bg-secondary"
            data-master-wizard-back
          >
            <ChevronLeft className="size-5" aria-hidden />
          </button>
        ) : null}
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary" aria-hidden>
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(step / TOTAL) * 100}%` }} />
        </div>
        <span className="shrink-0 text-sm font-bold text-muted-foreground">{t("masters.wizard.step", { current: step, total: TOTAL })}</span>
      </div>
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{titles[step]}</h1>
        {descs[step] ? <p className="mt-1 text-base text-muted-foreground">{descs[step]}</p> : null}
      </div>
      {body}
      {err(errors.category)}
      {err(errors.form)}
      {step > 1 ? (
        step < TOTAL ? (
          <Button type="button" size="xl" fullWidth className="h-14 text-lg" onClick={next} data-master-wizard-next>
            {t("masters.wizard.next")}
          </Button>
        ) : (
          <Button type="button" size="xl" fullWidth className="h-14 text-lg" onClick={publish} loading={busy} disabled={busy} data-master-wizard-publish>
            {busy ? t("masters.wizard.publishing") : t("masters.wizard.publish")}
          </Button>
        )
      ) : null}
    </div>
  );
}
