"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, RotateCcw } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { normalizePhone, formatPhone, formatMoney } from "@/lib/format";
import type { Category, District, Region } from "@/lib/reference";
import { Input, Textarea } from "@/components/ui/input";
import { ProfessionPicker } from "@/features/professions/components/profession-picker";
import { PhoneField } from "@/features/onboarding/components/steps/step-1-personal";
import { ProfessionImage } from "@/components/shared/profession-image";
import { celebrate } from "@/lib/celebrate";
import { cn } from "@/lib/utils";
import { publishWorkerListing } from "../actions";
import { parseMoney } from "../schema";
import { EMPTY_PLACE, SCHEDULES, SIMPLE_EXPERIENCE, type ListingStateInfo, type PostViewer, type WorkerDraft } from "../types";
import { useDraft, useStep } from "../use-draft";
import { BigCheckbox, MoneyInput, PhoneInput, VerifiedPhone, bigInput } from "./inputs";
import { PublishResult } from "./publish-result";
import { ModerationOutcome } from "./moderation-outcome";
import { RegionPicker, placeLabel } from "./region-picker";
import { ChoiceButtons, ChosenLine, FieldError, ReviewRow, WizardFrame, scrollToError } from "./wizard-frame";

const KEY = "ib_post_worker_v1";
const TOTAL = 4;
const PATH = "/post/worker";

const emptyDraft = (): WorkerDraft => ({
  v: 1,
  step: 1,
  profession: null,
  place: EMPTY_PLACE,
  remoteOk: false,
  firstName: "",
  lastName: "",
  phone: "+998 ",
  about: "",
  experience: null,
  salary: "",
  schedule: "",
  showPhone: false,
});

type Errors = Partial<Record<"profession" | "place" | "firstName" | "phone" | "about" | "experience" | "form", string>>;

/**
 * "Ish qidiryapman": 1/4 Kasb → 2/4 Hudud → 3/4 O'zingiz haqingizda → 4/4 Tekshirish va joylash.
 * Hisob faqat joylashda kerak; javoblar shu qurilmada saqlanadi va kirgandan keyin shu qadamga qaytiladi.
 */
export function WorkerPost({
  categories,
  regions,
  districts,
  viewer,
  prefill,
  existing,
  pricedDays,
}: {
  categories: Category[];
  regions: Region[];
  districts: District[];
  viewer: PostViewer;
  prefill: Partial<WorkerDraft>;
  existing: boolean;
  pricedDays: number;
}) {
  const { t, name, tEnum, locale } = useT();
  const router = useRouter();
  const { draft, update, ready, clear, reset } = useDraft<WorkerDraft>(KEY, () => ({ ...emptyDraft(), ...prefill }));
  const { step, go } = useStep(TOTAL, draft.step);
  const [errors, setErrors] = useState<Errors>({});
  const [pending, start] = useTransition();
  const [result, setResult] = useState<(ListingStateInfo & { workerId: string }) | null>(null);
  const [moreOpen, setMoreOpen] = useState(!!(draft.salary || draft.schedule));
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  const category = categories.find((c) => c.id === draft.profession?.categoryId) ?? null;
  const professionName = draft.profession ? name(draft.profession.trail.at(-1)!) : "";
  const professionTrail = draft.profession ? [category ? name(category) : null, ...draft.profession.trail.map((x) => name(x))].filter(Boolean).join(" › ") : "";
  const phone = viewer.loggedIn ? viewer.phone : normalizePhone(draft.phone);

  // tanlangan kasb rasmi (bo'lsa) — tekshirish sahifasida ko'rsatiladi
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

  const goTo = (n: number) => {
    setErrors({});
    update({ step: n });
    go(n);
  };

  const validate = (s: number): Errors => {
    const e: Errors = {};
    if (s >= 1 && !draft.profession) e.profession = t("easy.fields.profession");
    if (s >= 2 && (!draft.place.regionId || !draft.place.districtChosen)) e.place = draft.place.regionId ? t("easy.fields.district") : t("easy.fields.region");
    if (s >= 3) {
      if (draft.firstName.trim().length < 2) e.firstName = t("easy.fields.first_name");
      if (!viewer.loggedIn && !normalizePhone(draft.phone)) e.phone = t("easy.fields.phone");
      if (viewer.loggedIn && !viewer.phone) e.phone = t("easy.errors.phone_required");
      if (draft.about.trim().length < 10) e.about = t("easy.fields.about");
      if (!draft.experience) e.experience = t("easy.fields.experience");
    }
    return e;
  };

  const stepOf = (e: Errors) => (e.profession ? 1 : e.place ? 2 : e.firstName || e.phone || e.about || e.experience ? 3 : null);

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
      const res = await publishWorkerListing({
        professionNodeId: draft.profession!.id,
        headline: professionName,
        regionId: draft.place.regionId!,
        districtId: draft.place.districtId,
        remoteOk: draft.remoteOk,
        firstName: draft.firstName.trim(),
        lastName: draft.lastName.trim(),
        about: draft.about.trim(),
        experience: draft.experience!,
        salary: parseMoney(draft.salary),
        schedule: draft.schedule || null,
        showPhone: draft.showPhone,
      });
      if (!res.ok || !res.data) {
        const key = `easy.errors.${res.ok ? "generic" : res.error}`;
        const msg = t(key);
        setErrors({ form: msg === key ? t("easy.errors.generic") : msg });
        if (!res.ok && res.error === "phone_required") goTo(3);
        scrollToError();
        return;
      }
      // rad etilsa — yozilgan ma'lumot saqlanib qoladi (tuzatib qayta yuborish uchun)
      if (res.data.state !== "rejected") clear();
      setResult(res.data);
      if (res.data.state === "listed") celebrate();
      router.refresh();
    });
  };

  // moderator belgilagan maydonlar → qaysi qadam va qaysi maydonda xato ko'rsatiladi
  const FLAG_TO_FIELD: Record<string, { field: keyof Errors; step: number }> = {
    name: { field: "firstName", step: 3 },
    title: { field: "profession", step: 1 },
    profession: { field: "profession", step: 1 },
    description: { field: "about", step: 3 },
    experience: { field: "about", step: 3 },
    photo: { field: "about", step: 3 },
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
    const q = new URLSearchParams({ mode: "jobs" });
    if (draft.profession) q.set("p", draft.profession.id);
    const r = regions.find((x) => x.id === draft.place.regionId);
    if (r) q.set("region", r.slug);
    q.set("district", draft.place.districtId ?? "all");
    return `/search?${q.toString()}`;
  }, [draft.profession, draft.place, regions]);

  if (result) {
    if (["moderation_pending", "review", "rejected", "verification_pending"].includes(result.state)) {
      return (
        <ModerationOutcome
          entity="worker"
          id={result.workerId}
          info={result}
          fieldLabels={{
            name: t("easy.fields.first_name"),
            title: t("easy.fields.profession"),
            profession: t("easy.fields.profession"),
            description: t("easy.fields.about"),
            experience: t("easy.fields.about"),
            photo: t("easy.moderation.photo"),
          }}
          onEdit={() => editFlagged(result.fields)}
        />
      );
    }
    if (result.state === "listed") {
      return (
        <PublishResult
          tone="success"
          title={t("easy.worker.done_title")}
          description={t("easy.worker.done_desc")}
          actions={[
            { label: t("easy.worker.done_matches"), href: searchHref, primary: true },
            { label: t("easy.worker.done_view"), href: `/listing/${result.workerId}` },
          ]}
        />
      );
    }
    return (
      <PublishResult
        tone="payment"
        title={result.state === "payment_required" ? t("easy.worker.pay_title") : t("easy.worker.saved_title")}
        description={t("easy.worker.pay_desc", { days: pricedDays })}
        payment={result.state === "payment_required" ? { purpose: "worker_listing", targetId: result.workerId } : undefined}
        payLabel={t("easy.cabinet.pay")}
        actions={[{ label: t("easy.worker.done_view"), href: "/cabinet" }]}
      />
    );
  }

  if (!ready) {
    return <div className="container-narrow py-10 text-lg text-muted-foreground">{t("easy.wizard.loading")}</div>;
  }

  const stepNames = [t("easy.wizard.steps.profession"), t("easy.wizard.steps.location"), t("easy.wizard.steps.about"), t("easy.wizard.steps.review")];
  const loginHref = `/auth?${new URLSearchParams({ next: `${PATH}?step=${step}` }).toString()}`;
  const hasAnswers = !!(draft.profession || draft.place.regionId || draft.about);

  return (
    <WizardFrame
      title={existing ? t("easy.worker.edit_title") : t("easy.worker.page_title")}
      step={step}
      total={TOTAL}
      stepName={stepNames[step - 1]!}
      loggedIn={viewer.loggedIn}
      loginHref={loginHref}
      onBack={step > 1 ? () => goTo(step - 1) : undefined}
      backHref="/"
      onNext={step < TOTAL ? next : publish}
      nextLabel={step < TOTAL ? undefined : !viewer.loggedIn ? t("easy.wizard.login_to_publish") : existing ? t("easy.wizard.save_changes") : t("easy.wizard.publish")}
      nextIcon={step < TOTAL}
      pending={pending}
    >
      {step > 1 && step < TOTAL && draft.profession ? <ChosenLine label={t("easy.wizard.steps.profession")} value={professionTrail} /> : null}

      {step === 1 ? (
        <section className="space-y-3">
          <ProfessionPicker
            categories={categories}
            value={draft.profession}
            onChange={(p) => {
              update({ profession: p });
              setErrors({});
            }}
            title={t("easy.worker.profession_title")}
            subtitle={t("easy.worker.profession_subtitle")}
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
          <h1 className="text-2xl font-extrabold leading-tight sm:text-3xl">{t("easy.location.worker_title")}</h1>
          <RegionPicker regions={regions} districts={districts} value={draft.place} onChange={(place) => (update({ place }), setErrors({}))} invalid={!!errors.place} />
          <FieldError message={errors.place} />
          {draft.place.regionId ? (
            <BigCheckbox id="remote-ok" checked={draft.remoteOk} onChange={(v) => update({ remoteOk: v })} title={t("easy.location.worker_remote")} />
          ) : null}
        </section>
      ) : null}

      {step === 3 ? (
        <section className="space-y-6">
          <h1 className="text-2xl font-extrabold leading-tight sm:text-3xl">{t("easy.worker.about_title")}</h1>
          <div>
            <label htmlFor="first-name" className="mb-2 block text-lg font-semibold">
              {t("easy.worker.first_name")}
            </label>
            <Input id="first-name" autoComplete="given-name" value={draft.firstName} onChange={(e) => update({ firstName: e.target.value.slice(0, 60) })} invalid={!!errors.firstName} aria-describedby="first-name-err" className={bigInput} />
            <FieldError id="first-name-err" message={errors.firstName} />
          </div>
          <div>
            <label htmlFor="last-name" className="mb-2 block text-lg font-semibold">
              {t("easy.worker.last_name")} <span className="text-base font-normal text-muted-foreground">({t("easy.wizard.optional")})</span>
            </label>
            <Input id="last-name" autoComplete="family-name" value={draft.lastName} onChange={(e) => update({ lastName: e.target.value.slice(0, 60) })} className={bigInput} />
          </div>
          <div>
            <label htmlFor="phone" className="mb-2 block text-lg font-semibold">
              {t("easy.worker.phone")}
            </label>
            {viewer.loggedIn ? (
              viewer.phone ? (
                <VerifiedPhone phone={viewer.phone} />
              ) : (
                <PhoneField contacts={null} />
              )
            ) : (
              <>
                <PhoneInput id="phone" value={draft.phone} onChange={(v) => update({ phone: v })} invalid={!!errors.phone} describedBy="phone-hint" />
                <p id="phone-hint" className="mt-2 text-base text-muted-foreground">
                  {t("easy.worker.phone_hint")}
                </p>
              </>
            )}
            <FieldError message={errors.phone} />
          </div>
          <div>
            <label htmlFor="about" className="mb-2 block text-lg font-semibold">
              {t("easy.worker.about")}
            </label>
            <Textarea
              id="about"
              value={draft.about}
              onChange={(e) => update({ about: e.target.value.slice(0, 1000) })}
              placeholder={t("easy.worker.about_placeholder")}
              invalid={!!errors.about}
              aria-describedby="about-err"
              className="min-h-[140px] rounded-2xl text-lg"
            />
            <FieldError id="about-err" message={errors.about} />
          </div>
          <div>
            <p className="mb-2 text-lg font-semibold" id="exp-label">
              {t("easy.worker.experience")}
            </p>
            <ChoiceButtons
              label={t("easy.worker.experience")}
              value={draft.experience}
              invalid={!!errors.experience}
              onChange={(v) => update({ experience: v })}
              options={SIMPLE_EXPERIENCE.map((e) => ({ value: e, label: t(`easy.worker.exp.${e}`) }))}
            />
            <FieldError message={errors.experience} />
          </div>

          <div className="rounded-2xl border border-border bg-card">
            <button type="button" aria-expanded={moreOpen} onClick={() => setMoreOpen((o) => !o)} className="flex min-h-14 w-full items-center justify-between gap-3 px-4 text-left">
              <span>
                <span className="block text-lg font-semibold">{t("easy.worker.more")}</span>
                <span className="block text-base text-muted-foreground">{t("easy.worker.more_hint")}</span>
              </span>
              <ChevronDown className={cn("size-6 shrink-0 transition-transform", moreOpen && "rotate-180")} aria-hidden />
            </button>
            {moreOpen ? (
              <div className="space-y-5 border-t border-border p-4">
                <div>
                  <label htmlFor="salary" className="mb-2 block text-lg font-semibold">
                    {t("easy.worker.salary")}
                  </label>
                  <MoneyInput id="salary" value={draft.salary} onChange={(v) => update({ salary: v })} placeholder={t("easy.worker.salary_placeholder")} />
                </div>
                <div>
                  <p className="mb-2 text-lg font-semibold">{t("easy.worker.schedule")}</p>
                  <ChoiceButtons
                    label={t("easy.worker.schedule")}
                    value={draft.schedule}
                    onChange={(v) => update({ schedule: v })}
                    options={[{ value: "" as const, label: t("easy.worker.schedule_any") }, ...SCHEDULES.map((s) => ({ value: s, label: tEnum("work_schedule", s) }))]}
                  />
                </div>
                <p className="rounded-xl bg-secondary p-3 text-base text-muted-foreground">{t("easy.worker.photo_note")}</p>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {step === TOTAL ? (
        <section className="space-y-5">
          <h1 className="text-2xl font-extrabold leading-tight sm:text-3xl">{t("easy.worker.review_title")}</h1>
          <div className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4">
            <ProfessionImage url={imageUrl} categorySlug={category?.slug} icon={category?.icon} name={professionName} label={t("easy.image.label")} className="aspect-[4/3] w-32 shrink-0 sm:w-40" />
            <p className="text-base text-muted-foreground">{t("easy.wizard.image_note")}</p>
          </div>
          <div className="rounded-2xl border border-border bg-card px-4">
            <ReviewRow label={t("easy.wizard.steps.profession")} onChange={() => goTo(1)} changeLabel={t("easy.wizard.change")}>
              {professionTrail || "—"}
            </ReviewRow>
            <ReviewRow label={t("easy.wizard.steps.location")} onChange={() => goTo(2)} changeLabel={t("easy.wizard.change")}>
              {placeLabel(draft.place, regions, districts, name, t)}
              {draft.remoteOk ? <span className="block text-base font-normal text-muted-foreground">{t("easy.location.worker_remote")}</span> : null}
            </ReviewRow>
            <ReviewRow label={t("easy.worker.first_name")} onChange={() => goTo(3)} changeLabel={t("easy.wizard.change")}>
              {[draft.firstName, draft.lastName].filter((x) => x.trim()).join(" ") || "—"}
            </ReviewRow>
            <ReviewRow label={t("easy.worker.phone")} onChange={() => goTo(3)} changeLabel={t("easy.wizard.change")}>
              <span className="tabular">{phone ? formatPhone(phone) : "—"}</span>
            </ReviewRow>
            <ReviewRow label={t("easy.worker.about")} onChange={() => goTo(3)} changeLabel={t("easy.wizard.change")}>
              <span className="whitespace-pre-line font-normal">{draft.about || "—"}</span>
            </ReviewRow>
            <ReviewRow label={t("easy.worker.experience")} onChange={() => goTo(3)} changeLabel={t("easy.wizard.change")}>
              {draft.experience ? t(`easy.worker.exp.${draft.experience}`) : "—"}
            </ReviewRow>
            {draft.salary || draft.schedule ? (
              <ReviewRow label={t("easy.worker.more")} onChange={() => goTo(3)} changeLabel={t("easy.wizard.change")}>
                {[parseMoney(draft.salary) ? formatMoney(parseMoney(draft.salary), locale) : null, draft.schedule ? tEnum("work_schedule", draft.schedule) : null].filter(Boolean).join(" · ")}
              </ReviewRow>
            ) : null}
          </div>
          <BigCheckbox id="show-phone" checked={draft.showPhone} onChange={(v) => update({ showPhone: v })} title={t("easy.worker.consent_title")} description={draft.showPhone ? t("easy.worker.consent_desc") : t("easy.worker.consent_off")} />
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
