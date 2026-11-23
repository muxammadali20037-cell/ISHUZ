"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, ChevronRight, Eye, RotateCcw, UsersRound } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { callAction } from "@/lib/action-call";
import { normalizePhone, formatPhone } from "@/lib/format";
import type { Category, District, Region } from "@/lib/reference";
import { Input, Textarea } from "@/components/ui/input";
import { ProfessionPicker } from "@/features/professions/components/profession-picker";
import { ProfessionImage } from "@/components/shared/profession-image";
import { celebrate } from "@/lib/celebrate";
import { cn } from "@/lib/utils";
import { publishVacancyListing } from "../actions";
import { formatMoneyInput, parseMoney } from "../money";
import { EMPTY_PLACE, SCHEDULES, SIMPLE_EMPLOYER_TYPES, VACANCY_EXPERIENCE, type ListingStateInfo, type PostViewer, type VacancyDraft } from "../types";
import { clearEditedErrors } from "../field-errors";
import { useDraft, useStep } from "../use-draft";
import { vacancyDraftRules } from "../draft-rules";
import { track } from "@/features/analytics/client";
import { BigCheckbox, MoneyInput, PhoneInput, bigInput } from "./inputs";
import { PublishResult, type PublishedListing } from "./publish-result";
import { ListingImageDraft } from "@/features/listing-image/components/listing-image-draft";
import { ModerationOutcome } from "./moderation-outcome";
import { PhotoUpload } from "./photo-upload";
import { AiReadyBanner } from "./ai-quick-fill";
import { AiAvatar } from "@/components/shared/ai-avatar";
import { VacancyGuide } from "./vacancy-guide";
import type { ProfessionOption } from "../chat-actions";
import { RegionPicker, placeLabel } from "./region-picker";
import { PhonePublicNote } from "./phone-public-note";
import { ChoiceButtons, ChosenLine, CustomProfessionCard, FieldError, LocalChangesNotice, ReviewRow, WizardFrame, professionLabels, scrollToError } from "./wizard-frame";

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
  custom: null,
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

/** qoralama kaliti → xato kaliti (field-errors.ts) */
const FIELD_ERROR = {
  profession: "profession",
  custom: "profession",
  place: "place",
  employerType: "employerType",
  orgName: "orgName",
  phone: "phone",
  description: "description",
  salaryFrom: "salary",
  salaryTo: "salary",
  negotiable: "salary",
} as const;

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
  quick = [],
  customAllowed = false,
  photoQuarantine = false,
  dailyAllowed = false,
  imageEnabled = false,
}: {
  /** e'lon rasmi (AI) sozlangan — joylangach "Rasm yaratilsinmi?" */
  imageEnabled?: boolean;
  categories: Category[];
  regions: Region[];
  districts: District[];
  viewer: PostViewer;
  prefill: Partial<VacancyDraft>;
  editId: string | null;
  pricedDays: number;
  /** "AI bilan oson joylash" (?ai=1): kasb savolidagi tez variantlar */
  quick?: ProfessionOption[];
  /** baza "Kasbim topilmadi" ni qo'llaydimi (0057) */
  customAllowed?: boolean;
  /** rasm yopiq karantin bucket'ga yuklanadimi (0058) */
  photoQuarantine?: boolean;
  /** baza kunlik haqni saqlay oladimi (0060) — "Oylik / Kunlik" tanlovi */
  dailyAllowed?: boolean;
}) {
  const { t, name, tEnum } = useT();
  const router = useRouter();
  const rules = useMemo(() => vacancyDraftRules(editId), [editId]);
  const { draft, update: rawUpdate, ready, clear, reset, restored, dismissRestored, prepareAuthHandoff } = useDraft<VacancyDraft>({
    entity: "vacancy",
    editId,
    userId: viewer.userId,
    makeInitial: () => ({ ...emptyDraft(), ...prefill }),
    rules,
    compareIgnore: ["step", "clientRef", "image"],
  });
  const { step, go } = useStep(TOTAL, draft.step);
  // "AI bilan oson joylash" — savollar bittadan (?ai=1); "Oddiy forma" bosilsa — shu qoralama bilan oddiy qadamlar
  const params = useSearchParams();
  const guideOn = !editId && params.get("ai") === "1";
  const leaveGuide = (n: number) => {
    const url = new URL(window.location.href);
    url.searchParams.delete("ai");
    url.searchParams.set("step", String(n));
    window.history.replaceState(null, "", url);
    update({ step: n });
    window.scrollTo({ top: 0 });
  };
  const [errors, setErrors] = useState<Errors>({});
  // maydon tahrirlansa — o'sha maydonning eski xatosi o'chadi (tuzatilgan maydonda qizil matn qolib ketmaydi)
  const update = useCallback(
    (patch: Partial<VacancyDraft>) => {
      rawUpdate(patch);
      setErrors((e) => clearEditedErrors(e, Object.keys(patch), FIELD_ERROR));
    },
    [rawUpdate],
  );
  const [pending, start] = useTransition();
  const [result, setResult] = useState<(ListingStateInfo & { vacancyId: string; slug: string; listing?: PublishedListing }) | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  const { category, professionName, professionTrail } = professionLabels(draft, categories, name, t("professions.custom_badge"));
  // mavjud vakansiyaning maosh davri (kunlik/soatlik raqam oylik deb ko'rsatilmaydi)
  const salaryPeriod = draft.salaryType && draft.salaryType !== "monthly" ? draft.salaryType : null;
  // oylik / kunlik shu formada tanlanadi (0060); soatlik va ishbay — faqat batafsil tahrirda
  const payChoice = dailyAllowed && (!draft.salaryType || draft.salaryType === "monthly" || draft.salaryType === "daily");
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
    if (s >= 1 && !draft.profession && !draft.custom) e.profession = t("easy.fields.profession");
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

  const salaryText = draft.negotiable
    ? t("easy.vacancy.negotiable")
    : [parseMoney(draft.salaryFrom) !== null ? `${formatMoneyInput(draft.salaryFrom)} ${t("easy.vacancy.salary_from")}` : null, parseMoney(draft.salaryTo) !== null ? `${formatMoneyInput(draft.salaryTo)} ${t("easy.vacancy.salary_to")}` : null]
        .filter(Boolean)
        .join(" ") + ` ${t("billing.currency")}`;

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
      prepareAuthHandoff({ step: TOTAL });
      const q = new URLSearchParams({ next: `${PATH}?step=${TOTAL}` });
      if (phone) q.set("phone", phone);
      router.push(`/auth?${q.toString()}`);
      return;
    }
    start(async () => {
      const res = await callAction(() => publishVacancyListing({
        vacancyId: draft.editId,
        clientRef: draft.clientRef,
        professionNodeId: draft.profession?.id ?? null,
        customProfession: draft.profession ? null : (draft.custom ?? null),
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
        salaryType: payChoice ? (draft.salaryType === "daily" ? "daily" : "monthly") : undefined,
        experienceMonths: draft.experienceMonths,
        showPhone: true,
        photoPath: draft.photoPath ?? null,
        source: draft.source ?? "manual",
        // tekshirish sahifasida tanlangan AI rasm (ega, 2026-11-22: "ma'qul kelsa joylash")
        imageDraft: imageEnabled ? (draft.image?.draft ?? null) : null,
      }));
      if (!res.ok || !res.data) {
        const key = `easy.errors.${res.ok ? "generic" : res.error}`;
        const msg = t(key);
        setErrors({ form: msg === key ? t("easy.errors.generic") : msg });
        scrollToError();
        return;
      }
      // joylangan e'lonning qisqa ko'rinishi — qoralama tozalanishidan oldin ("E'loningiz joylandi" ekranidagi karta)
      const listing: PublishedListing = {
        title: draft.title.trim() || professionName,
        salary: { from: draft.negotiable ? null : parseMoney(draft.salaryFrom), to: draft.negotiable ? null : parseMoney(draft.salaryTo), type: draft.salaryType === "daily" ? "daily" : "monthly", negotiable: draft.negotiable },
        place: placeLabel(draft.place, regions, districts, name, t),
      };
      // rad etilsa — yozilgan ma'lumot saqlanib qoladi (tuzatib qayta yuborish uchun; o'sha e'lon yangilanadi)
      if (res.data.state !== "rejected") clear();
      setResult({ ...res.data, listing });
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
          listing={result.listing}
          share={{ path: `/jobs/${result.slug}`, text: result.listing?.title ?? t("easy.vacancy.done_title") }}
          actions={[
            { label: t("easy.vacancy.done_matches"), href: searchHref, primary: true, icon: <UsersRound className="size-5 shrink-0" aria-hidden /> },
            // ish beruvchining birinchi savoli: "ish izlovchilarga qanday ko'rinyapti?" — holat, qidiruvdagi o'rni, karta, to'liq ko'rinish
            { label: t("easy.publish.view"), href: `/employer/vacancies/${result.vacancyId}#korinish`, icon: <Eye className="size-5 shrink-0" aria-hidden /> },
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
          listing={result.listing}
          actions={[
            { label: t("easy.vacancy.done_view"), href: `/employer/vacancies/${result.vacancyId}#korinish`, primary: true },
            { label: t("easy.cabinet.title"), href: "/cabinet" },
          ]}
        />
      );
    }
    return (
      <PublishResult
        tone="payment"
        title={result.state === "payment_required" ? t("easy.vacancy.pay_title") : t("easy.worker.saved_title")}
        description={t("easy.vacancy.pay_desc", { days: pricedDays })}
        payment={result.state === "payment_required" ? { purpose: "vacancy_publish", targetId: result.vacancyId } : undefined}
        actions={[{ label: t("easy.cabinet.title"), href: "/cabinet" }]}
      />
    );
  }

  if (guideOn) {
    return (
      <VacancyGuide
        initialSentence={(params.get("q") ?? "").slice(0, 300)}
        regions={regions}
        districts={districts}
        quick={quick}
        draft={draft}
        update={update}
        viewer={viewer}
        dailyAllowed={dailyAllowed}
        busy={!ready}
        pending={pending}
        error={errors.form ?? null}
        imageEnabled={imageEnabled}
        onPublish={() => {
          // savollar majburiy maydonlarni to'ldiradi; baribir xato bo'lsa — oddiy formada o'sha maydon ko'rsatiladi
          if (stepOf(validate(3))) leaveGuide(TOTAL);
          publish();
        }}
        onClassic={() => leaveGuide(draft.profession || draft.custom ? TOTAL : 1)}
      />
    );
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
  const hasAnswers = !editId && !!(draft.profession || draft.custom || draft.place.regionId || draft.description);

  return (
    <WizardFrame
      busy={!ready}
      title={editId ? t("easy.vacancy.edit_title") : t("easy.vacancy.page_title")}
      step={step}
      total={TOTAL}
      stepName={stepNames[step - 1]!}
      loggedIn={viewer.loggedIn}
      loginHref={loginHref}
      onLogin={() => prepareAuthHandoff()}
      onBack={step > 1 ? () => goTo(step - 1) : undefined}
      backHref={editId ? "/cabinet" : "/"}
      onNext={step < TOTAL ? next : publish}
      nextLabel={step < TOTAL ? undefined : !viewer.loggedIn ? t("easy.wizard.login_to_publish") : editId ? t("easy.wizard.save_changes") : t("easy.wizard.publish")}
      nextIcon={step < TOTAL}
      pending={pending}
    >
      {restored && editId ? <LocalChangesNotice onKeep={dismissRestored} onDiscard={() => (reset(), setErrors({}), go(1, true))} /> : null}
      {step > 1 && step < TOTAL && (draft.profession || draft.custom) ? <ChosenLine label={t("easy.wizard.steps.specialist")} value={professionTrail} /> : null}

      {step === 1 ? (
        <section className="space-y-3">
          {!draft.profession && draft.custom ? (
            <CustomProfessionCard text={draft.custom.text} sector={category ? name(category) : null} badge={t("professions.custom_badge")} hint={t("easy.wizard.custom_note")} />
          ) : null}
          <ProfessionPicker
            headingLevel={1}
            categories={categories}
            value={draft.profession}
            onChange={(p) => {
              update({ profession: p, custom: null });
              setErrors({});
            }}
            onCustom={
              customAllowed
                ? (text, categoryId) => {
                    update({ profession: null, custom: { text: text.trim().replace(/\s+/g, " ").slice(0, 120), categoryId } });
                    setErrors({});
                    goTo(2);
                  }
                : undefined
            }
            title={t("easy.vacancy.profession_title")}
            subtitle={t("easy.vacancy.profession_subtitle")}
            extra={
              !editId ? (
                // bir gap yozib, savollarga tugma bilan javob berish ("AI bilan oson joylash")
                <Link href={`${PATH}?ai=1`} className="press flex w-full items-center gap-3 rounded-2xl border border-ai/25 bg-ai-soft/60 px-3.5 py-3 text-left hover:border-ai/50" data-guide-open>
                  <AiAvatar size="sm" className="shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-base font-bold leading-snug">{t("easy.vguide.entry_title")}</span>
                    <span className="block text-sm text-muted-foreground">{t("easy.vguide.entry_desc")}</span>
                  </span>
                  <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                </Link>
              ) : undefined
            }
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
            <PhoneInput id="phone" value={draft.phone} onChange={(v) => update({ phone: v })} invalid={!!errors.phone} describedBy="phone-public-hint" />
            <p id="phone-public-hint" className="mt-2 text-base text-muted-foreground">
              {t("easy.phone_public.hint")} {t("easy.phone_public.title")}.
            </p>
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
            <legend className="mb-2 text-lg font-semibold">{salaryPeriod ? t(`easy.vacancy.salary_period_${salaryPeriod}`) : t("easy.vacancy.salary")}</legend>
            {payChoice ? (
              <div className="mb-3">
                <ChoiceButtons
                  label={t("easy.vacancy.pay_period")}
                  value={draft.salaryType === "daily" ? "daily" : "monthly"}
                  onChange={(v) => update({ salaryType: v })}
                  options={[
                    { value: "monthly" as const, label: t("easy.vacancy.pay_monthly"), description: t("easy.vacancy.pay_monthly_desc") },
                    { value: "daily" as const, label: t("easy.vacancy.pay_daily"), description: t("easy.vacancy.pay_daily_desc") },
                  ]}
                />
              </div>
            ) : salaryPeriod && editId ? (
              <p className="mb-3 text-base text-muted-foreground">
                {t("easy.vacancy.salary_period_note")}{" "}
                <a href={`/employer/vacancies/${editId}/edit`} className="font-semibold text-primary-ink underline underline-offset-4">
                  {t("easy.vacancy.detailed_edit")}
                </a>
              </p>
            ) : null}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <MoneyInput id="salary-from" value={draft.salaryFrom} onChange={(v) => update({ salaryFrom: v })} placeholder={draft.salaryType === "daily" ? "150 000" : "3 000 000"} disabled={draft.negotiable} invalid={!!errors.salary} label={t("easy.vacancy.salary_from")} />
                <p className="mt-1 text-base text-muted-foreground">{t("easy.vacancy.salary_from")}</p>
              </div>
              <div>
                <MoneyInput id="salary-to" value={draft.salaryTo} onChange={(v) => update({ salaryTo: v })} placeholder={draft.salaryType === "daily" ? "300 000" : "6 000 000"} disabled={draft.negotiable} invalid={!!errors.salary} label={t("easy.vacancy.salary_to")} />
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
                {viewer.userId ? <PhotoUpload userId={viewer.userId} value={draft.photoPath ?? null} onChange={(photoPath) => update({ photoPath })} quarantine={photoQuarantine} /> : null}
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {step === TOTAL ? (
        <section className="space-y-5">
          <h1 className="text-2xl font-extrabold leading-tight sm:text-3xl">{t("easy.vacancy.review_title")}</h1>
          {draft.source === "ai" ? <AiReadyBanner questions={aiQuestions} onEdit={() => goTo(3)} /> : null}
          {imageEnabled && viewer.loggedIn ? (
            // e'lon rasmi — joylashdan OLDIN (ega, 2026-11-22: "ma'qul kelsa joylash kerak")
            <ListingImageDraft entity="vacancy" professionId={draft.profession?.id ?? null} title={draft.title.trim() || professionName} value={draft.image ?? null} onChange={(image) => update({ image })} />
          ) : (
            <div className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4">
              <ProfessionImage url={imageUrl} icon={category?.icon} name={professionName} label={t("easy.image.label")} className="aspect-[4/3] w-32 shrink-0 sm:w-40" />
              <div className="min-w-0">
                <p className="text-xl font-bold leading-snug">{draft.title.trim() || professionName}</p>
                <p className="mt-1 text-base text-muted-foreground">{t("easy.wizard.image_note")}</p>
              </div>
            </div>
          )}
          <div className="rounded-2xl border border-border bg-card px-4">
            <ReviewRow label={t("easy.wizard.steps.specialist")} onChange={() => goTo(1)} changeLabel={t("easy.wizard.change")}>
              {/* asosiysi — kasb nomi; soha yo'li ostida kichik */}
              {professionName || "—"}
              {professionTrail && professionTrail !== professionName ? <span className="block text-base font-normal text-muted-foreground">{professionTrail}</span> : null}
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
            <ReviewRow label={salaryPeriod ? t(`easy.vacancy.salary_period_${salaryPeriod}`) : t("easy.vacancy.salary")} onChange={() => goTo(3)} changeLabel={t("easy.wizard.change")}>
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
          {/* 2026-11-18 (ega): raqam majburiy va hammaga ko'rinadi — tanlov belgisi o'rnida ochiq ogohlantirish */}
          <PhonePublicNote kind="vacancy" />
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
