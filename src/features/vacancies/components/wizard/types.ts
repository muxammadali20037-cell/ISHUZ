import type { Benefit, Category, District, Language, Region, Skill, Subcategory } from "@/lib/reference";
import type { WizardMode } from "../../steps";
import type { VacancyFull } from "../../types";

export interface WizardRefs {
  categories: Category[];
  subcategories: Subcategory[];
  regions: Region[];
  districts: District[];
  languages: Language[];
  benefits: Benefit[];
}

export interface StepProps {
  mode: WizardMode;
  vacancy: VacancyFull;
  refs: WizardRefs;
}

export interface SkillsStepProps extends StepProps {
  suggestedSkills: Skill[];
}
