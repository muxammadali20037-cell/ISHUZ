import { getT } from "@/lib/i18n/server";
import { PageHeader } from "@/components/ui/misc";
import type { SessionContext } from "@/features/auth/session";
import { getEditReferenceData, getWorkerProfileFull } from "../../queries";
import { AboutForm } from "./about-form";
import { CategoryForm } from "./category-form";
import { EditTabs } from "./edit-tabs";
import { EducationSection } from "./education-section";
import { ExperienceSection } from "./experience-section";
import { LanguagesForm } from "./languages-form";
import { LocationForm } from "./location-form";
import { PersonalForm } from "./personal-form";
import { PreferencesForm } from "./preferences-form";
import { SkillsForm } from "./skills-form";
import { VisibilityForm } from "./visibility-form";

/** /profile/edit: har bo'lim mustaqil forma (o'z "Saqlash"i bilan), yopishqoq tab chizig'i */
export async function ProfileEditor({ session, workerId }: { session: SessionContext; workerId: string }) {
  const { t } = await getT();
  const data = await getWorkerProfileFull(workerId);
  if (!data) return null;
  const ref = await getEditReferenceData(data.worker.category_id);
  const p = session.profile;

  return (
    <div className="container-narrow py-4 sm:py-6">
      <PageHeader title={t("profile.edit.title")} subtitle={t("profile.edit.subtitle")} backHref="/profile" />
      <EditTabs />
      <div className="mt-4 space-y-4">
        <PersonalForm profile={{ id: p.id, first_name: p.first_name, last_name: p.last_name, birth_date: p.birth_date, gender: p.gender, avatar_url: p.avatar_url }} />
        <AboutForm headline={data.worker.headline} about={data.worker.about} />
        <LocationForm
          regions={ref.regions}
          districts={ref.districts}
          initial={{
            region_id: data.worker.region_id,
            district_id: data.worker.district_id,
            area_hint: data.worker.area_hint,
            remote_preference: data.worker.remote_preference,
            work_district_ids: data.locations.map((l) => l.district_id),
            geo: data.geo ? { lat: data.geo.lat, lng: data.geo.lng } : null,
          }}
        />
        <CategoryForm
          categories={ref.categories}
          subcategories={ref.subcategories}
          initial={{ category_id: data.worker.category_id, subcategory_id: data.worker.subcategory_id, experience_level: data.worker.experience_level }}
        />
        <ExperienceSection items={data.experience} />
        <SkillsForm
          initial={data.skills.flatMap((s) => (s.skill ? [{ id: s.skill.id, name_uz: s.skill.name_uz, name_ru: s.skill.name_ru, level: s.level }] : []))}
          suggested={ref.suggestedSkills}
          categoryId={data.worker.category_id}
        />
        <LanguagesForm initial={data.languages.map((l) => ({ code: l.language_code, level: l.level }))} languages={ref.languages} />
        <EducationSection items={data.education} />
        <PreferencesForm initial={data.preferences} workFormat={data.worker.work_format} officialTerms={ref.officialTerms} />
        <VisibilityForm isPublic={data.worker.is_public} />
      </div>
    </div>
  );
}
