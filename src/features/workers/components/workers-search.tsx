"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Briefcase, MapPin, Clock, Wallet, CalendarDays, LocateFixed, Loader2, Search, SlidersHorizontal, X } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import type { TFunction } from "@/lib/i18n/translate";
import { formatMoneyShort } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { Chip, FilterChip } from "@/components/ui/chip";
import { toast } from "@/components/ui/toast";
import { clearFilters, countActiveFilters, DEFAULT_STATUSES, EXPERIENCE_MIN_OPTIONS, type WorkerSearchParams } from "../search-params";
import type { DistanceOrigin, MyVacancy } from "../types";
import { FilterSheet, type FilterReference, type SheetKind } from "./filter-sheets";
import { VacancyBanner } from "./vacancy-banner";
import { useWorkersNav } from "./use-workers-nav";
import { useGeolocate } from "./use-geolocate";

interface ActiveChip {
  key: string;
  label: string;
  remove: Partial<WorkerSearchParams>;
}

/** Tajriba chipi matni: preset bo'lsa tarjima, aks holda "18+" */
function experienceLabel(t: TFunction, months: number): string {
  return (EXPERIENCE_MIN_OPTIONS as readonly number[]).includes(months) ? t(`enums.experience_min_months.${months}`) : `${months}+`;
}

/**
 * Qidiruv sarlavhasi: matn qidiruvi, tez chiplar (Sheet ochadi), tanlangan filtrlar qatori, vakansiya banneri.
 * Butun holat URL'da; navigatsiya transition ichida.
 */
export function WorkersSearch({
  params,
  reference,
  vacancies,
  vacancy,
  origin,
}: {
  params: WorkerSearchParams;
  reference: FilterReference;
  vacancies: MyVacancy[];
  vacancy: MyVacancy | null;
  origin: DistanceOrigin | null;
}) {
  const { t, tEnum, locale, name } = useT();
  const { navigate, pending } = useWorkersNav(params);
  const { locate, locating } = useGeolocate();
  const [sheet, setSheet] = useState<SheetKind | null>(null);
  const [q, setQ] = useState(params.q ?? "");
  // URL'dagi q o'zgarsa (orqaga/oldinga, chip orqali tozalash) inputni sinxronlash — render vaqtida, effect'siz
  const [syncedQ, setSyncedQ] = useState(params.q);
  if (syncedQ !== params.q) {
    setSyncedQ(params.q);
    setQ(params.q ?? "");
  }

  const vacancyHasCoords = vacancy?.lat != null && vacancy.lng != null;
  const category = reference.categories.find((c) => c.slug === params.category) ?? null;
  const subcategory = category ? (reference.subcategories.find((s) => s.slug === params.subcategory && s.category_id === category.id) ?? null) : null;
  const region = reference.regions.find((r) => r.slug === params.region) ?? null;
  const activeCount = countActiveFilters(params);

  const chips = useMemo<ActiveChip[]>(() => {
    const out: ActiveChip[] = [];
    if (category) out.push({ key: "category", label: name(category), remove: { category: null, subcategory: null } });
    if (subcategory) out.push({ key: "subcategory", label: name(subcategory), remove: { subcategory: null } });
    if (region) out.push({ key: "region", label: name(region), remove: { region: null, district: [] } });
    if (params.district.length) {
      const names = params.district.map((id) => reference.districts.find((d) => d.id === id)).filter((d): d is NonNullable<typeof d> => !!d);
      const label = names.length && names.length <= 2 ? names.map((d) => name(d)).join(", ") : t("workers.filters.selected_count", { count: params.district.length });
      out.push({ key: "district", label, remove: { district: [] } });
    }
    if (params.experience_min !== null) out.push({ key: "experience", label: experienceLabel(t, params.experience_min), remove: { experience_min: null } });
    if (params.salary_max !== null) out.push({ key: "salary", label: t("workers.filters.salary_up_to", { amount: formatMoneyShort(params.salary_max, locale) }), remove: { salary_max: null } });
    for (const s of params.schedule) out.push({ key: `schedule-${s}`, label: tEnum("work_schedule", s), remove: { schedule: params.schedule.filter((x) => x !== s) } });
    for (const e of params.employment) out.push({ key: `employment-${e}`, label: tEnum("employment_type", e), remove: { employment: params.employment.filter((x) => x !== e) } });
    if (params.format && params.format !== "any") out.push({ key: "format", label: tEnum("work_format", params.format), remove: { format: null } });
    if (params.gender) out.push({ key: "gender", label: tEnum("gender", params.gender), remove: { gender: null } });
    if (params.education_min) out.push({ key: "education", label: tEnum("education_level", params.education_min), remove: { education_min: null } });
    for (const l of params.languages) out.push({ key: `lang-${l}`, label: tEnum("language_code", l), remove: { languages: params.languages.filter((x) => x !== l) } });
    for (const id of params.skills) {
      const skill = reference.skills.find((s) => s.id === id);
      out.push({ key: `skill-${id}`, label: skill ? name(skill) : t("workers.filters.skills"), remove: { skills: params.skills.filter((x) => x !== id) } });
    }
    const statusIsDefault = params.status.length === DEFAULT_STATUSES.length && params.status.every((s) => DEFAULT_STATUSES.includes(s));
    if (!statusIsDefault) out.push({ key: "status", label: params.status.map((s) => tEnum("worker_status_short", s)).join(", "), remove: { status: [...DEFAULT_STATUSES] } });
    for (const a of params.availability) out.push({ key: `avail-${a}`, label: tEnum("availability", a), remove: { availability: params.availability.filter((x) => x !== a) } });
    if (params.portfolio) out.push({ key: "portfolio", label: t("workers.filters.portfolio"), remove: { portfolio: false } });
    if (params.verified) out.push({ key: "verified", label: t("workers.filters.verified"), remove: { verified: false } });
    if (params.remote !== null) out.push({ key: "remote", label: params.remote ? t("workers.filters.remote_yes") : t("workers.filters.remote_no"), remove: { remote: null } });
    if (params.lat !== null) {
      out.push({ key: "me", label: t("workers.search.my_location"), remove: { lat: null, lng: null, max_km: vacancyHasCoords ? params.max_km : null, sort: params.sort === "distance" && !vacancyHasCoords ? "relevant" : params.sort } });
    }
    if (params.max_km !== null && origin) out.push({ key: "km", label: t("workers.filters.max_km", { km: params.max_km }), remove: { max_km: null } });
    return out;
  }, [params, category, subcategory, region, reference, origin, vacancyHasCoords, t, tEnum, name, locale]);

  const submitQuery = (e: FormEvent) => {
    e.preventDefault();
    const next = q.trim() || null;
    if (next !== params.q) navigate({ q: next });
  };

  const nearMe = async () => {
    if (origin?.source === "me") {
      navigate({ lat: null, lng: null, max_km: vacancyHasCoords ? params.max_km : null, sort: params.sort === "distance" && !vacancyHasCoords ? "relevant" : params.sort });
      return;
    }
    const pos = await locate();
    if (!pos) return;
    toast.success(t("workers.search.location_set"));
    navigate({ lat: pos.lat, lng: pos.lng, max_km: params.max_km ?? 10, sort: "distance" });
  };

  const quick: { kind: SheetKind; icon: React.ReactNode; label: string; active: boolean }[] = [
    { kind: "category", icon: <Briefcase />, label: category ? name(category) : t("workers.search.chip_category"), active: !!category },
    { kind: "region", icon: <MapPin />, label: region ? name(region) : t("workers.search.chip_region"), active: !!region },
    { kind: "experience", icon: <Clock />, label: params.experience_min !== null ? experienceLabel(t, params.experience_min) : t("workers.search.chip_experience"), active: params.experience_min !== null },
    { kind: "salary", icon: <Wallet />, label: params.salary_max !== null ? formatMoneyShort(params.salary_max, locale) : t("workers.search.chip_salary"), active: params.salary_max !== null },
    {
      kind: "schedule",
      icon: <CalendarDays />,
      label: params.schedule.length || params.employment.length ? `${t("workers.search.chip_schedule")} · ${params.schedule.length + params.employment.length}` : t("workers.search.chip_schedule"),
      active: params.schedule.length + params.employment.length > 0,
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <h1 className="text-xl font-bold sm:text-2xl">{t("workers.search.title")}</h1>
        <span className={pending ? "text-xs text-muted-foreground" : "invisible text-xs"} aria-live="polite">
          {t("workers.search.updating")}
        </span>
      </div>

      <VacancyBanner params={params} vacancies={vacancies} vacancy={vacancy} />

      <form onSubmit={submitQuery} role="search">
        <Input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("workers.search.placeholder")}
          leftIcon={<Search />}
          enterKeyHint="search"
          aria-label={t("common.actions.search")}
          rightSlot={
            q ? (
              <button
                type="button"
                className="flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary"
                aria-label={t("common.actions.clear")}
                onClick={() => {
                  setQ("");
                  if (params.q) navigate({ q: null });
                }}
              >
                <X className="size-4" />
              </button>
            ) : null
          }
        />
      </form>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 scrollbar-none sm:mx-0 sm:flex-wrap sm:px-0">
        {quick.map((c) => (
          <Chip key={c.kind} selected={c.active} icon={c.icon} onClick={() => setSheet(c.kind)} className="shrink-0">
            {c.label}
          </Chip>
        ))}
        <Chip selected={origin?.source === "me"} icon={locating ? <Loader2 className="animate-spin" /> : <LocateFixed />} onClick={() => void nearMe()} disabled={locating} className="shrink-0">
          {t("workers.search.near_me")}
        </Chip>
        <Chip selected={activeCount > 0} icon={<SlidersHorizontal />} onClick={() => setSheet("all")} className="shrink-0">
          {activeCount ? t("workers.search.chip_all_count", { count: activeCount }) : t("workers.search.chip_all")}
        </Chip>
      </div>

      {chips.length ? (
        <div className="flex flex-wrap items-center gap-2">
          {chips.map((c) => (
            <FilterChip key={c.key} onRemove={() => navigate(c.remove)}>
              {c.label}
            </FilterChip>
          ))}
          <button type="button" className="h-8 px-2 text-sm font-medium text-muted-foreground hover:text-foreground" onClick={() => navigate({ ...clearFilters(params), page: 1 })}>
            {t("common.actions.clear_all")}
          </button>
        </div>
      ) : null}

      <FilterSheet kind={sheet} onClose={() => setSheet(null)} params={params} reference={reference} vacancyHasCoords={vacancyHasCoords} onApply={(d) => navigate({ ...d, page: 1 })} />
    </div>
  );
}
