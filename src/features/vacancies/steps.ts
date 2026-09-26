/** Wizard qadamlari — tartib, majburiylik, URL yordamchilari (sof mantiq, test qilinadi) */

export const STEP_KEYS = ["title", "category", "location", "salary", "schedule", "requirements", "skills", "work_format", "description", "benefits"] as const;
export type StepKey = (typeof STEP_KEYS)[number];
export type WizardStep = StepKey | "review";
export type WizardMode = "create" | "edit";

export const TOTAL_STEPS = STEP_KEYS.length;

/** "Keyinroq" tugmasi bilan o'tkazib yuborish mumkin bo'lgan qadamlar */
const OPTIONAL: ReadonlySet<StepKey> = new Set<StepKey>(["salary", "schedule", "requirements", "skills", "work_format", "description", "benefits"]);

export function isOptionalStep(step: StepKey): boolean {
  return OPTIONAL.has(step);
}

export function isStepKey(value: string): value is StepKey {
  return (STEP_KEYS as readonly string[]).includes(value);
}

/** 1 dan boshlanadigan tartib raqami */
export function stepIndex(step: StepKey): number {
  return STEP_KEYS.indexOf(step) + 1;
}

/** ?step= qiymatini qadamga aylantiradi: "3", "location", "review" */
export function stepFromParam(param: string | string[] | undefined): WizardStep {
  const raw = Array.isArray(param) ? param[0] : param;
  if (!raw) return "title";
  if (raw === "review") return "review";
  if (isStepKey(raw)) return raw;
  const n = Number(raw);
  if (Number.isInteger(n) && n >= 1 && n <= TOTAL_STEPS) return STEP_KEYS[n - 1] ?? "title";
  return "title";
}

export function nextStep(step: StepKey): WizardStep {
  const i = STEP_KEYS.indexOf(step);
  return STEP_KEYS[i + 1] ?? "review";
}

export function prevStep(step: WizardStep): StepKey | null {
  if (step === "review") return STEP_KEYS[TOTAL_STEPS - 1] ?? null;
  const i = STEP_KEYS.indexOf(step);
  return i > 0 ? (STEP_KEYS[i - 1] ?? null) : null;
}

/** Wizard URL: yaratishda ?id=&step=, tahrirlashda /[id]/edit?step= */
export function wizardHref(mode: WizardMode, vacancyId: string | null, step: WizardStep): string {
  const s = step === "review" ? "review" : String(stepIndex(step));
  if (mode === "edit" && vacancyId) return `/employer/vacancies/${vacancyId}/edit?step=${s}`;
  if (vacancyId) return `/employer/vacancies/new?id=${vacancyId}&step=${s}`;
  return `/employer/vacancies/new`;
}

/** publish_vacancy 'vacancy_incomplete' bergan qadamlar */
export function missingSteps(v: { title: string | null; category_id: string | null; region_id: string | null; is_remote: boolean }): StepKey[] {
  const out: StepKey[] = [];
  if (!v.title || v.title.trim().length < 2) out.push("title");
  if (!v.category_id) out.push("category");
  if (!v.is_remote && !v.region_id) out.push("location");
  return out;
}

/** Tugallangan qadamlar (progress ko'rsatish uchun) */
export function completedSteps(v: {
  title: string | null;
  category_id: string | null;
  region_id: string | null;
  is_remote: boolean;
  salary_from: number | null;
  salary_to: number | null;
  salary_negotiable: boolean;
  work_time_from: string | null;
  experience_min_months: number;
  age_min: number | null;
  education_min: string | null;
  gender: string | null;
  description: string | null;
  skillsCount: number;
  languagesCount: number;
  benefitsCount: number;
  official_terms: string[];
}): Set<StepKey> {
  const done = new Set<StepKey>();
  if (v.title && v.title.trim().length >= 2) done.add("title");
  if (v.category_id) done.add("category");
  if (v.is_remote || v.region_id) done.add("location");
  if (v.salary_negotiable || v.salary_from || v.salary_to) done.add("salary");
  if (v.work_time_from) done.add("schedule");
  if (v.experience_min_months > 0 || v.age_min || v.education_min || v.gender || v.languagesCount > 0) done.add("requirements");
  if (v.skillsCount > 0) done.add("skills");
  if (v.official_terms.length > 0) done.add("work_format");
  if (v.description && v.description.trim().length > 0) done.add("description");
  if (v.benefitsCount > 0) done.add("benefits");
  return done;
}
