"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, RotateCcw } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { normalizePhone, formatPhone } from "@/lib/format";
import type { Category, District, Region } from "@/lib/reference";
import { Input, Textarea } from "@/components/ui/input";
import { ProfessionPicker } from "@/features/professions/components/profession-picker";
import { ProfessionImage } from "@/components/shared/profession-image";
import { celebrate } from "@/lib/celebrate";
import { cn } from "@/lib/utils";
import { publishVacancyListing } from "../actions";
import { formatMoneyInput, parseMoney } from "../schema";
import { EMPTY_PLACE, SCHEDULES, SIMPLE_EMPLOYER_TYPES, VACANCY_EXPERIENCE, type ListingStateInfo, type PostViewer, type VacancyDraft } from "../types";
import { useDraft, useStep } from "../use-draft";
import { track } from "@/features/analytics/client";
import { BigCheckbox, MoneyInput, PhoneInput, bigInput } from "./inputs";
import { PublishResult } from "./publish-result";
import { ModerationOutcome } from "./moderation-outcome";
import { PhotoUpload } from "./photo-upload";
import { AiQuickFill, AiReadyBanner, mergeAiDraft } from "./ai-quick-fill";
import { RegionPicker, placeLabel } from "./region-picker";
import { ChoiceButtons, ChosenLine, FieldError, ReviewRow, WizardFrame, scrollToError } from "./wizard-frame";

const TOTAL = 4;
const PATH = "/post/vacancy";

function newRef(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  // eski brauzerlar uchun (RFC 4122 v4 ko'rinishi)
  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) => (Number(c) ^ (Math.floor(Math.random() * 16) >> (Number(c) / 4))).toString(16));
}

const emptyDraft = (): VacancyDraft => ({
  v: 1,
  step: 1,
  clientRef: newRef(),
  editId: null,
  profession: null,
  place: EMPTY_PLACE,
  employerType: null,
  orgName: "",
  phone: "+998 ",
  description: "",
  salaryFrom: "",
  salaryTo: "",
  negotiable: false,
  title: "",
  schedule: "",
  experienceMonths: 0,
  showPhone: false,
});

type Errors = Partial<Record<"profession" | "place" | "employerType" | "orgName" | "phone" | "description" | "salary" | "form", string>>;

/**
 * "Ishchi qidiryapman": 1/4 Mutaxassis → 2/4 Hudud → 3/4 Ish haqida → 4/4 Tekshirish va joylash.
 * Jismoniy shaxsdan rekvizit so'ralmaydi. Takroriy bosish yangi e'lon yaratmaydi (clientRef).
 */
export function VacancyPost({
  categories,
  regions,
  districts,
  viewer,
  prefill,
  editId,
  pricedDays,
  aiEnabled = false,
}: {
  categories: Category[];
  regions: Region[];
  districts: District[];
  viewer: PostViewer;
  prefill: Partial<VacancyDraft>;
  editId: string | null;
  pricedDays: number;
  aiEnabled?: boolean;
}) {
  const { t, name, tEnum } = useT();
  const router = useRouter();
  const storageKey = editId ? `ib_post_vacancy_edit_${editId}` : "ib_post_vacancy_v1";
  const { draft, update, ready, clear, reset } = useDraft<VacancyDraft>(storageKey, () => ({ ...emptyDraft(), ...prefill }));
  const { step, go } = useStep(TOTAL, draft.step);
  const [errors, setErrors] = useState<Errors>({});
  const [pending, start] = useTransition();
  const [result, setResult] = useState<(ListingStateInfo & { vacancyId: string; slug: string }) | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  const category = categories.find((c) => c.id === draft.profession?.categoryId) ?? null;
  const professionName = draft.profession ? name(draft.profession.trail.at(-1)!) : "";
  const professionTrail = draft.profession ? [category ? name(category) : null, ...draft.profession.trail.map((x) => name(x))].filter(Boolean).join(" › ") : "";
  const phone = normalizePhone(draft.phone);
  const isPerson = draft.employerType === "person";

  const professionId = draft.profession?.id;
  useEffect(() => {
    if (!professionId || step !== TOTAL) return;
    let alive = true;
    fetch(`/api/profession-images?ids=${professionId}`)
      .then((r) => r.json() as Promise<{ images: Record<string, string> }>)
      .then((d) => alive && setImageUrl(d.images?.[professionId] ?? null))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [professionId, step]);

  // voronka: e'lon boshlandi / tekshirish sahifasiga yetdi (har biri bir marta)
  const tracked = useRef({ start: false, review: false });
  useEffect(() => {
    if (!ready) return;
    if (!tracked.current.start) {
      tracked.current.start = true;
      track("post_start", { entity: "vacancy" });
    }
    if (step === TOTAL && !tracked.current.review) {
      tracked.current.review = true;
      track("post_review", { entity: "vacancy", source: draft.source ?? "manual" });
    }
  }, [ready, step, draft.source]);

  const goTo = (n: number) => {
    setErrors({});
    update({ step: n });
    go(n);
  };

  const validate = (s: number): Errors => {
    const e: Errors = {};
    if (s >= 1 && !draft.profession) e.profession = t("easy.fields.profession");
    if (s >= 2 && !draft.place.remote && (!draft.place.regionId || !draft.place.districtChosen)) e.place = draft.place.regionId ? t("easy.fields.district") : t("easy.fields.region");
    if (s >= 3) {
      if (!draft.employerType) e.employerType = t("easy.fields.employer_type");
      if (draft.orgName.trim().length < 2) e.orgName = t("easy.fields.org_name");
      if (!phone) e.phone = t("easy.fields.phone");
      if (draft.description.trim().length < 10) e.description = t("easy.fields.description");
      const from = parseMoney(draft.salaryFrom);
      const to = parseMoney(draft.salaryTo);
      if (!draft.negotiable && from === null && to === null) e.salary = t("easy.fields.salary");
      else if (!draft.negotiable && from !== null && to !== null && to < from) e.salary = t("easy.fields.salary_range");
    }
    return e;
  };

  const stepOf = (e: Errors) => (e.profession ? 1 : e.place ? 2 : e.employerType || e.orgName || e.phone || e.description || e.salary ? 3 : null);

  const next = () => {
    const e = validate(step);
    const bad = stepOf(e);
    if (bad && bad <= step) {
      if (bad < step) goTo(bad);
      setErrors({ ...e, form: t("easy.fields.fix_above") });
      scrollToError();
      return;
    }
    goTo(step + 1);
  };

  const publish = () => {
    const e = validate(3);
    const bad = stepOf(e);
    if (bad) {
      goTo(bad);
      setErrors({ ...e, form: t("easy.fields.fix_above") });
      scrollToError();
      return;
    }
    if (!viewer.loggedIn) {
      update({ step: TOTAL });
      const q = new URLSearchParams({ next: `${PATH}?step=${TOTAL}` });
      if (phone) q.set("phone", phone);
      router.push(`/auth?${q.toString()}`);
      return;
    }
    start(async () => {
      const res = await publishVacancyListing({
        vacancyId: draft.editId,
        clientRef: draft.clientRef,
        professionNodeId: draft.profession!.id,
        title: draft.title.trim() || professionName,
        regionId: draft.place.remote ? null : draft.place.regionId,
        districtId: draft.place.remote ? null : draft.place.districtId,
        remote: draft.place.remote,
        employerType: draft.employerType!,
        orgName: draft.orgName.trim(),
        phone: phone!,
        description: draft.description.trim(),
        negotiable: draft.negotiable,
        salaryFrom: draft.negotiable ? null : parseMoney(draft.salaryFrom),
        salaryTo: draft.negotiable ? null : parseMoney(draft.salaryTo),
        schedule: draft.schedule || null,
        experienceMonths: draft.experienceMonths,
        showPhone: draft.showPhone,
        photoPath: draft.photoPath ?? null,
        source: draft.source ?? "manual",
      });
      if (!res.ok || !res.data) {
        const key = `easy.errors.${res.ok ? "generic" : res.error}`;
        const msg = t(key);
        setErrors({ form: msg === key ? t("easy.errors.generic") : msg });
        scrollToError();
        return;
      }
      // rad etilsa — yozilgan ma'lumot saqlanib qoladi (tuzatib qayta yuborish uchun; o'sha e'lon yangilanadi)
      if (res.data.state !== "rejected") clear();
      setResult(res.data);
      if (res.data.state === "active") celebrate();
      router.refresh();
    });
  };

  // moderator belgilagan maydonlar → qaysi qadam va qaysi maydonda xato ko'rsatiladi
  const FLAG_TO_FIELD: Record<string, { field: keyof Errors; step: number }> = {
    title: { field: "profession", step: 1 },
    profession: { field: "profession", step: 1 },
    address: { field: "place", step: 2 },
    employer: { field: "orgName", step: 3 },
    logo: { field: "orgName", step: 3 },
    links: { field: "description", step: 3 },
    description: { field: "description", step: 3 },
    photo: { field: "description", step: 3 },
  };
  const editFlagged = (fields: string[]) => {
    const hits = fields.map((f) => FLAG_TO_FIELD[f] ?? FLAG_TO_FIELD.description!);
    const e: Errors = { form: t("easy.moderation.edit_hint") };
    for (const h of hits) e[h.field] = t("easy.moderation.field_flagged");
    setResult(null);
    goTo(Math.min(...hits.map((h) => h.step), 3));
    setErrors(e);
    scrollToError();
  };

  const searchHref = useMemo(() => {
    const q = new URLSearchParams({ mode: "workers" });
    if (draft.profession) q.set("p", draft.profession.id);
    if (draft.place.remote) q.set("region", "remote");
    else {
      const r = regions.find((x) => x.id === draft.place.regionId);
      if (r) q.set("region", r.slug);
      q.set("district", draft.place.districtId ?? "all");
    }
    return `/search?${q.toString()}`;
  }, [draft.profession, draft.place, regions]);

  if (result) {
    if (["moderation_pending", "review", "rejected", "verification_pending"].includes(result.state)) {
      return (
        <ModerationOutcome
          entity="vacancy"
          id={result.vacancyId}
          info={result}
          fieldLabels={{
            title: t("easy.wizard.steps.specialist"),
            profession: t("easy.wizard.steps.specialist"),
            address: t("easy.wizard.steps.location"),
            employer: t("easy.vacancy.org_name"),
            logo: t("easy.moderation.logo"),
            links: t("easy.vacancy.description"),
            description: t("easy.vacancy.description"),
            photo: t("easy.moderation.photo"),
          }}
          onEdit={() => editFlagged(result.fields)}
        />
      );
    }
    if (result.state === "active") {
      return (
        <PublishResult
          tone="success"
          title={t("easy.vacancy.done_title")}
          description={t("easy.vacancy.done_desc")}
          actions={[
            { label: t("easy.vacancy.done_matches"), href: searchHref, primary: true },
            { label: t("easy.vacancy.done_view"), href: `/jobs/${result.slug}` },
          ]}
        />
      );
    }
    if (result.state === "review") {
      return (
        <PublishResult
          tone="review"
          title={t("easy.vacancy.review_state_title")}
          description={t("easy.vacancy.review_state_desc")}
          actions={[
            { label: t("easy.vacancy.done_view"), href: `/employer/vacancies/${result.vacancyId}`, primary: true },
            { label: t("easy.cabinet.title"), href: "/cabinet" },
          ]}
        />
      );
    }
    return (
      <PublishResult
        tone="payment"
        title={t("easy.vacancy.pay_title")}
        description={t("easy.vacancy.pay_desc", { days: pricedDays })}
        payment={result.state === "payment_required" ? { purpose: "vacancy_publish", targetId: result.vacancyId } : undefined}
        payLabel={t("easy.cabinet.pay")}
        actions={[{ label: t("easy.cabinet.title"), href: "/cabinet" }]}
      />
    );
  }

  if (!ready) {
    return <div className="container-narrow py-10 text-lg text-muted-foreground">{t("easy.wizard.loading")}</div>;
  }

  // AI qoralamasi: yetishmayotgan majburiy maydonlar → qisqa savollar
  const aiQuestions = (() => {
    if (draft.source !== "ai") return [];
    const e = validate(3);
    const q: { label: string; onClick: () => void }[] = [];
    if (e.profession) q.push({ label: e.profession, onClick: () => goTo(1) });
    if (e.place) q.push({ label: e.place, onClick: () => goTo(2) });
    for (const k of ["employerType", "orgName", "phone", "description", "salary"] as const) if (e[k]) q.push({ label: e[k]!, onClick: () => goTo(3) });
    return q;
  })();

  const stepNames = [t("easy.wizard.steps.specialist"), t("easy.wizard.steps.location"), t("easy.wizard.steps.job"), t("easy.wizard.steps.review")];
  const loginHref = `/auth?${new URLSearchParams({ next: `${editId ? `${PATH}?edit=${editId}&` : `${PATH}?`}step=${step}` }).toString()}`;
  const hasAnswers = !editId && !!(draft.profession || draft.place.regionId || draft.description);
  const salaryText = draft.negotiable
    ? t("easy.vacancy.negotiable")
    : [parseMoney(draft.salaryFrom) !== null ? `${formatMoneyInput(draft.salaryFrom)} ${t("easy.vacancy.salary_from")}` : null, parseMoney(draft.salaryTo) !== null ? `${formatMoneyInput(draft.salaryTo)} ${t("easy.vacancy.salary_to")}` : null]
        .filter(Boolean)
        .join(" ") + ` ${t("billing.currency")}`;

  return (
    <WizardFrame
      title={editId ? t("easy.vacancy.edit_title") : t("easy.vacancy.page_title")}
      step={step}
      total={TOTAL}
      stepName={stepNames[step - 1]!}
      loggedIn={viewer.loggedIn}
      loginHref={loginHref}
      onBack={step > 1 ? () => goTo(step - 1) : undefined}
      backHref={editId ? "/cabinet" : "/"}
      onNext={step < TOTAL ? next : publish}
      nextLabel={step < TOTAL ? undefined : !viewer.loggedIn ? t("easy.wizard.login_to_publish") : editId ? t("easy.wizard.save_changes") : t("easy.wizard.publish")}
      nextIcon={step < TOTAL}
      pending={pending}
    >
      {step > 1 && step < TOTAL && draft.profession ? <ChosenLine label={t("easy.wizard.steps.specialist")} value={professionTrail} /> : null}

      {step === 1 ? (
        <section className="space-y-3">
          {aiEnabled && !editId ? (
            <AiQuickFill
              kind="vacancy"
              onReady={(d) => {
                update({ ...mergeAiDraft(draft, d.vacancy ?? {}), source: "ai", step: TOTAL });
                setErrors({});
                go(TOTAL);
              }}
            />
          ) : null}
          <ProfessionPicker
            categories={categories}
            value={draft.profession}
            onChange={(p) => {
              update({ profession: p });
              setErrors({});
            }}
            title={t("easy.vacancy.profession_title")}
            subtitle={t("easy.vacancy.profession_subtitle")}
          />
          <FieldError message={errors.profession} />
          {hasAnswers ? (
            <button type="button" onClick={() => (reset(), setErrors({}), go(1, true))} className="inline-flex min-h-12 items-center gap-2 text-base font-medium text-muted-foreground hover:text-foreground">
              <RotateCcw className="size-4" aria-hidden /> {t("easy.wizard.start_over")}
            </button>
          ) : null}
        </section>
      ) : null}

      {step === 2 ? (
        <section className="space-y-4">
          <h1 className="text-2xl font-extrabold leading-tight sm:text-3xl">{t("easy.location.vacancy_title")}</h1>
          <RegionPicker regions={regions} districts={districts} value={draft.place} onChange={(place) => (update({ place }), setErrors({}))} allowRemote invalid={!!errors.place} />
          <FieldError message={errors.place} />
        </section>
      ) : null}

      {step === 3 ? (
        <section className="space-y-6">
          <h1 className="text-2xl font-extrabold leading-tight sm:text-3xl">{t("easy.vacancy.job_title")}</h1>
          <div>
            <p className="mb-2 text-lg font-semibold">{t("easy.vacancy.employer_type")}</p>
            <ChoiceButtons
              label={t("easy.vacancy.employer_type")}
              value={draft.employerType}
              invalid={!!errors.employerType}
              onChange={(v) => update({ employerType: v })}
              options={SIMPLE_EMPLOYER_TYPES.map((v) => ({ value: v, label: t(`easy.vacancy.types.${v}`) }))}
            />
            <FieldError message={errors.employerType} />
          </div>
          <div>
            <label htmlFor="org" className="mb-2 block text-lg font-semibold">
              {isPerson ? t("easy.vacancy.person_name") : t("easy.vacancy.org_name")}
            </label>
            <Input
              id="org"
              autoComplete={isPerson ? "name" : "organization"}
              value={draft.orgName}
              onChange={(e) => update({ orgName: e.target.value.slice(0, 120) })}
              placeholder={isPerson ? t("easy.vacancy.person_placeholder") : t("easy.vacancy.org_placeholder")}
              invalid={!!errors.orgName}
              className={bigInput}
            />
            <FieldError message={errors.orgName} />
          </div>
          <div>
            <label htmlFor="phone" className="mb-2 block text-lg font-semibold">
              {t("easy.vacancy.phone")}
            </label>
            <PhoneInput id="phone" value={draft.phone} onChange={(v) => update({ phone: v })} invalid={!!errors.phone} />
            <FieldError message={errors.phone} />
          </div>
          <div>
            <label htmlFor="desc" className="mb-2 block text-lg font-semibold">
              {t("easy.vacancy.description")}
            </label>
            <Textarea
              id="desc"
              value={draft.description}
              onChange={(e) => update({ description: e.target.value.slice(0, 4000) })}
              placeholder={t("easy.vacancy.description_placeholder")}
              invalid={!!errors.description}
              className="min-h-[140px] rounded-2xl text-lg"
            />
            <FieldError message={errors.description} />
          </div>
          <fieldset>
            <legend className="mb-2 text-lg font-semibold">{t("easy.vacancy.salary")}</legend>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <MoneyInput id="salary-from" value={draft.salaryFrom} onChange={(v) => update({ salaryFrom: v })} placeholder="3 000 000" disabled={draft.negotiable} invalid={!!errors.salary} label={t("easy.vacancy.salary_from")} />
                <p className="mt-1 text-base text-muted-foreground">{t("easy.vacancy.salary_from")}</p>
              </div>
              <div>
                <MoneyInput id="salary-to" value={draft.salaryTo} onChange={(v) => update({ salaryTo: v })} placeholder="6 000 000" disabled={draft.negotiable} invalid={!!errors.salary} label={t("easy.vacancy.salary_to")} />
                <p className="mt-1 text-base text-muted-foreground">{t("easy.vacancy.salary_to")}</p>
              </div>
            </div>
            <div className="mt-3">
              <BigCheckbox id="negotiable" checked={draft.negotiable} onChange={(v) => update({ negotiable: v })} title={t("easy.vacancy.negotiable")} />
            </div>
            <FieldError message={errors.salary} />
          </fieldset>

          <div className="rounded-2xl border border-border bg-card">
            <button type="button" aria-expanded={moreOpen} onClick={() => setMoreOpen((o) => !o)} className="flex min-h-14 w-full items-center justify-between gap-3 px-4 text-left">
              <span>
                <span className="block text-lg font-semibold">{t("easy.vacancy.more")}</span>
                <span className="block text-base text-muted-foreground">{t("easy.vacancy.more_hint")}</span>
              </span>
              <ChevronDown className={cn("size-6 shrink-0 transition-transform", moreOpen && "rotate-180")} aria-hidden />
            </button>
            {moreOpen ? (
              <div className="space-y-5 border-t border-border p-4">
                <div>
                  <label htmlFor="title" className="mb-2 block text-lg font-semibold">
                    {t("easy.vacancy.title_field")}
                  </label>
                  <Input id="title" value={draft.title} onChange={(e) => update({ title: e.target.value.slice(0, 120) })} placeholder={professionName} className={bigInput} />
                  <p className="mt-1 text-base text-muted-foreground">{t("easy.vacancy.title_hint")}</p>
                </div>
                <div>
                  <p className="mb-2 text-lg font-semibold">{t("easy.vacancy.schedule")}</p>
                  <ChoiceButtons
                    label={t("easy.vacancy.schedule")}
                    value={draft.schedule}
                    onChange={(v) => update({ schedule: v })}
                    options={[{ value: "" as const, label: t("easy.vacancy.negotiable") }, ...SCHEDULES.map((s) => ({ value: s, label: tEnum("work_schedule", s) }))]}
                  />
                </div>
                <div>
                  <p className="mb-2 text-lg font-semibold">{t("easy.vacancy.experience")}</p>
                  <ChoiceButtons
                    label={t("easy.vacancy.experience")}
                    value={draft.experienceMonths}
                    onChange={(v) => update({ experienceMonths: v })}
                    options={VACANCY_EXPERIENCE.map((m) => ({ value: m, label: t(`easy.vacancy.exp.${m}`) }))}
                  />
                </div>
                {viewer.userId ? <PhotoUpload userId={viewer.userId} value={draft.photoPath ?? null} onChange={(photoPath) => update({ photoPath })} /> : null}
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {step === TOTAL ? (
        <section className="space-y-5">
          <h1 className="text-2xl font-extrabold leading-tight sm:text-3xl">{t("easy.vacancy.review_title")}</h1>
          {draft.source === "ai" ? <AiReadyBanner questions={aiQuestions} onEdit={() => goTo(3)} /> : null}
          <div className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4">
            <ProfessionImage url={imageUrl} categorySlug={category?.slug} icon={category?.icon} name={professionName} label={t("easy.image.label")} className="aspect-[4/3] w-32 shrink-0 sm:w-40" />
            <div className="min-w-0">
              <p className="text-xl font-bold leading-snug">{draft.title.trim() || professionName}</p>
              <p className="mt-1 text-base text-muted-foreground">{t("easy.wizard.image_note")}</p>
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-card px-4">
            <ReviewRow label={t("easy.wizard.steps.specialist")} onChange={() => goTo(1)} changeLabel={t("easy.wizard.change")}>
              {professionTrail || "—"}
            </ReviewRow>
            <ReviewRow label={t("easy.wizard.steps.location")} onChange={() => goTo(2)} changeLabel={t("easy.wizard.change")}>
              {placeLabel(draft.place, regions, districts, name, t)}
            </ReviewRow>
            <ReviewRow label={t("easy.vacancy.employer_type")} onChange={() => goTo(3)} changeLabel={t("easy.wizard.change")}>
              {draft.orgName || "—"}
              {draft.employerType ? <span className="block text-base font-normal text-muted-foreground">{t(`easy.vacancy.types.${draft.employerType}`)}</span> : null}
            </ReviewRow>
            <ReviewRow label={t("easy.vacancy.phone")} onChange={() => goTo(3)} changeLabel={t("easy.wizard.change")}>
              <span className="tabular">{phone ? formatPhone(phone) : "—"}</span>
            </ReviewRow>
            <ReviewRow label={t("easy.vacancy.salary")} onChange={() => goTo(3)} changeLabel={t("easy.wizard.change")}>
              {salaryText}
            </ReviewRow>
            <ReviewRow label={t("easy.vacancy.description")} onChange={() => goTo(3)} changeLabel={t("easy.wizard.change")}>
              <span className="whitespace-pre-line font-normal">{draft.description || "—"}</span>
            </ReviewRow>
            {draft.schedule || draft.experienceMonths ? (
              <ReviewRow label={t("easy.vacancy.more")} onChange={() => goTo(3)} changeLabel={t("easy.wizard.change")}>
                {[draft.schedule ? tEnum("work_schedule", draft.schedule) : null, draft.experienceMonths ? `${t("easy.vacancy.experience")}: ${t(`easy.vacancy.exp.${draft.experienceMonths}`)}` : null].filter(Boolean).join(" · ")}
              </ReviewRow>
            ) : null}
          </div>
          <BigCheckbox id="show-phone" checked={draft.showPhone} onChange={(v) => update({ showPhone: v })} title={t("easy.vacancy.consent_title")} description={draft.showPhone ? t("easy.vacancy.consent_desc") : t("easy.vacancy.consent_off")} />
          {!viewer.loggedIn ? (
            <div className="rounded-2xl border-2 border-primary/40 bg-primary-soft/50 p-4">
              <p className="text-lg font-bold">{t("easy.wizard.login_needed_title")}</p>
              <p className="mt-1 text-base">{t("easy.wizard.login_needed_desc")}</p>
            </div>
          ) : null}
          <FieldError message={errors.form} />
        </section>
      ) : null}
    </WizardFrame>
  );
}
