"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Briefcase, GraduationCap, Languages, MapPin, Pencil, Sparkles, Star, UserRound, Wallet } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { Constants, type Enums } from "@/types/database.types";
import type { Category, District, Language, Region, Subcategory } from "@/lib/reference";
import { formatMoney } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { ChipGroup } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { birthDateBounds } from "@/features/onboarding/utils";
import { analyzeWorkerText, applyWorkerPlan, type WorkerAiPreview } from "../actions";
import { AiComposer } from "./ai-composer";

export interface WorkerAiRefs {
  categories: Category[];
  subcategories: Subcategory[];
  regions: Region[];
  districts: District[];
  languages: Language[];
}

type Personal = { first_name: string; last_name: string; birth_date: string; gender: Enums<"gender"> | null };

export function WorkerAiAssistant({ refs, current, manualHref }: { refs: WorkerAiRefs; current: Personal; manualHref: string }) {
  const { t } = useT();
  const router = useRouter();
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<WorkerAiPreview | null>(null);
  const [personal, setPersonal] = useState<Personal>(current);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const errorText = (code: string) => {
    const key = `ai.errors.${code}`;
    const msg = t(key);
    return msg === key ? t("common.errors.generic") : msg;
  };

  const analyze = (value: string) => {
    setText(value);
    setError(null);
    startTransition(async () => {
      const res = await analyzeWorkerText({ text: value });
      if (!res.ok || !res.data) {
        setError(errorText(res.ok ? "ai_failed" : res.error));
        return;
      }
      const p = res.data.plan.personal;
      // AI topganini ustun qo'yamiz, topmaganini — mavjud profildan
      setPersonal({
        first_name: p.first_name || current.first_name,
        last_name: p.last_name || current.last_name,
        birth_date: p.birth_date || current.birth_date,
        gender: p.gender ?? current.gender,
      });
      setPreview(res.data);
      window.scrollTo({ top: 0 });
    });
  };

  const save = () => {
    if (!preview) return;
    setError(null);
    startTransition(async () => {
      const res = await applyWorkerPlan({ ...preview.plan, personal });
      if (!res.ok || !res.data) {
        setError(errorText(res.ok ? "generic" : res.error));
        return;
      }
      router.push(res.data.redirect);
      router.refresh();
    });
  };

  if (!preview) {
    return (
      <AiComposer
        title={t("ai.worker.title")}
        subtitle={t("ai.worker.subtitle")}
        placeholder={t("ai.worker.placeholder")}
        hints={t("ai.worker.hints")}
        pending={pending}
        error={error}
        initialText={text}
        manualHref={manualHref}
        manualLabel={t("ai.worker.manual")}
        onSubmit={analyze}
      />
    );
  }

  return <Review preview={preview} refs={refs} personal={personal} setPersonal={setPersonal} pending={pending} error={error} onSave={save} onRewrite={() => setPreview(null)} />;
}

function Review({
  preview,
  refs,
  personal,
  setPersonal,
  pending,
  error,
  onSave,
  onRewrite,
}: {
  preview: WorkerAiPreview;
  refs: WorkerAiRefs;
  personal: Personal;
  setPersonal: (p: Personal) => void;
  pending: boolean;
  error: string | null;
  onSave: () => void;
  onRewrite: () => void;
}) {
  const { t, tEnum, name, locale } = useT();
  const { plan, skillNames } = preview;
  const bounds = birthDateBounds();
  const byId = <T extends { id: string }>(list: T[], id: string | null | undefined) => (id ? list.find((x) => x.id === id) : undefined);
  const missing = t("ai.not_found");

  const needNames = personal.first_name.trim().length < 2 || personal.last_name.trim().length < 2;
  const needBirth = !personal.birth_date;
  const needGender = !personal.gender;

  const loc = plan.location;
  const prof = plan.profession;
  const pref = plan.preferences;
  const salary = pref?.salary_expected ?? pref?.salary_min ?? null;

  return (
    <div className="container-narrow space-y-4 py-5 sm:py-8">
      <div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-success-soft px-3 py-1 text-xs font-semibold text-success">
          <Sparkles className="size-3.5" />
          {t("ai.badge")}
        </span>
        <h1 className="mt-3 text-2xl font-bold sm:text-3xl">{t("ai.worker.review_title")}</h1>
        <p className="mt-1.5 text-[15px] text-muted-foreground">{t("ai.worker.review_subtitle")}</p>
      </div>

      {needNames || needBirth || needGender ? (
        <div className="space-y-4 rounded-2xl border border-warning/40 bg-warning-soft/40 p-4">
          <p className="text-sm font-semibold">{t("ai.worker.need_title")}</p>
          {needNames ? (
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("onboarding.worker.personal.first_name")} htmlFor="ai-first" required>
                <Input id="ai-first" value={personal.first_name} onChange={(e) => setPersonal({ ...personal, first_name: e.target.value })} autoComplete="given-name" />
              </Field>
              <Field label={t("onboarding.worker.personal.last_name")} htmlFor="ai-last" required>
                <Input id="ai-last" value={personal.last_name} onChange={(e) => setPersonal({ ...personal, last_name: e.target.value })} autoComplete="family-name" />
              </Field>
            </div>
          ) : null}
          {needBirth ? (
            <Field label={t("onboarding.worker.personal.birth_date")} htmlFor="ai-birth" required description={t("onboarding.worker.personal.birth_date_hint")}>
              <Input id="ai-birth" type="date" min={bounds.min} max={bounds.max} value={personal.birth_date} onChange={(e) => setPersonal({ ...personal, birth_date: e.target.value })} />
            </Field>
          ) : null}
          {needGender ? (
            <Field label={t("onboarding.worker.personal.gender")} required>
              <ChipGroup
                size="lg"
                options={Constants.public.Enums.gender.map((g) => ({ value: g, label: tEnum("gender", g) }))}
                value={personal.gender}
                onChange={(v) => setPersonal({ ...personal, gender: (Array.isArray(v) ? v[0] : v) ?? null })}
              />
            </Field>
          ) : null}
        </div>
      ) : null}

      <Section icon={<UserRound />} title={t("ai.sections.personal")}>
        <Row value={`${personal.first_name} ${personal.last_name}`.trim() || missing} />
        {personal.gender ? <Row value={tEnum("gender", personal.gender)} /> : null}
      </Section>

      <Section icon={<Briefcase />} title={t("ai.sections.profession")}>
        <Row value={prof?.headline ?? missing} strong />
        <Row value={[name(byId(refs.categories, prof?.category_id)), name(byId(refs.subcategories, prof?.subcategory_id))].filter(Boolean).join(" · ") || missing} />
        <Row value={tEnum("experience_level", plan.experience.experience_level)} />
        {plan.experience.entries.map((e) => (
          <Row key={`${e.company_name}-${e.started_on}`} value={`${e.position} — ${e.company_name}`} />
        ))}
      </Section>

      <Section icon={<MapPin />} title={t("ai.sections.location")}>
        <Row value={loc ? [name(byId(refs.regions, loc.region_id)), name(byId(refs.districts, loc.district_id))].filter(Boolean).join(", ") : missing} />
      </Section>

      <Section icon={<Star />} title={t("ai.sections.skills")}>
        {plan.skills.skills.length ? (
          <div className="flex flex-wrap gap-1.5">
            {plan.skills.skills.map((s) => (
              <span key={s.skill_id} className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium">
                {name(skillNames[s.skill_id])}
              </span>
            ))}
          </div>
        ) : (
          <Row value={missing} />
        )}
      </Section>

      <Section icon={<Languages />} title={t("ai.sections.languages")}>
        <Row
          value={plan.skills.languages
            .map((l) => `${name(refs.languages.find((x) => x.code === l.language_code)) || l.language_code} (${tEnum("language_level", l.level)})`)
            .join(", ")}
        />
      </Section>

      {plan.education ? (
        <Section icon={<GraduationCap />} title={t("ai.sections.education")}>
          <Row value={tEnum("education_level", plan.education.level)} />
          {plan.education.entries.map((e) => (
            <Row key={e.institution} value={[e.institution, e.field].filter(Boolean).join(" — ")} />
          ))}
        </Section>
      ) : null}

      <Section icon={<Wallet />} title={t("ai.sections.preferences")}>
        {pref ? (
          <>
            {salary ? <Row value={`${formatMoney(salary, locale)} · ${tEnum("salary_type", pref.salary_type)}`} strong /> : null}
            <Row value={[tEnum("availability", pref.availability), tEnum("work_format", pref.work_format)].join(" · ")} />
            {pref.employment_types.length ? <Row value={pref.employment_types.map((v) => tEnum("employment_type", v)).join(", ")} /> : null}
            {pref.schedules.length ? <Row value={pref.schedules.map((v) => tEnum("work_schedule", v)).join(", ")} /> : null}
          </>
        ) : (
          <Row value={missing} />
        )}
      </Section>

      {plan.about ? (
        <Section icon={<Pencil />} title={t("ai.sections.about")}>
          <p className="whitespace-pre-line text-sm leading-relaxed">{plan.about}</p>
        </Section>
      ) : null}

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <div className="sticky bottom-0 z-30 -mx-4 border-t border-border/70 bg-background/95 px-4 pb-safe pt-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0">
        <Button size="lg" fullWidth loading={pending} onClick={onSave}>
          {t("ai.worker.save")}
          {!pending ? <ArrowRight className="size-5" /> : null}
        </Button>
        <Button variant="ghost" fullWidth className="mt-1 text-muted-foreground" onClick={onRewrite} disabled={pending}>
          {t("ai.rewrite")}
        </Button>
        <div className="h-2 sm:h-0" />
      </div>
    </div>
  );
}

function Section({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground [&_svg]:size-4 [&_svg]:text-primary">
        {icon}
        {title}
      </p>
      <div className="space-y-1">{children}</div>
    </section>
  );
}

function Row({ value, strong }: { value: string; strong?: boolean }) {
  return <p className={strong ? "text-base font-semibold" : "text-sm"}>{value}</p>;
}
