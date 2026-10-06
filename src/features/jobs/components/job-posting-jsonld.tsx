import { publicEnv } from "@/lib/env";
import type { Enums } from "@/types/database.types";
import { descriptionToPlainText } from "../description";
import type { VacancyDetail } from "../types";

const EMPLOYMENT: Record<Enums<"employment_type">, string> = {
  full_time: "FULL_TIME",
  part_time: "PART_TIME",
  permanent: "FULL_TIME",
  temporary: "TEMPORARY",
  shift: "FULL_TIME",
  remote: "FULL_TIME",
  freelance: "CONTRACTOR",
  internship: "INTERN",
};
const UNIT: Record<Enums<"salary_type">, string> = { monthly: "MONTH", daily: "DAY", hourly: "HOUR", piecework: "MONTH", negotiable: "MONTH" };
const EDUCATION: Record<Enums<"education_level">, string> = {
  secondary: "high school",
  vocational: "associate degree",
  incomplete_higher: "high school",
  higher: "bachelor degree",
  master: "postgraduate degree",
};

/** schema.org JobPosting (Google Jobs). Faqat faol vakansiya uchun. */
export function JobPostingJsonLd({ vacancy: v }: { vacancy: VacancyDetail }) {
  if (v.status !== "active") return null;
  const base = publicEnv.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  const url = `${base}/jobs/${v.slug}`;
  const description = descriptionToPlainText(v.description) || v.title;
  const hasSalary = !v.salary_negotiable && (v.salary_from || v.salary_to);
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: v.title,
    description,
    identifier: { "@type": "PropertyValue", name: "Ish Beruvchi", value: v.id },
    datePosted: v.published_at ?? v.created_at,
    validThrough: v.expires_at ?? undefined,
    employmentType: EMPLOYMENT[v.employment_type],
    url,
    directApply: true,
    hiringOrganization: {
      "@type": "Organization",
      name: v.company?.name ?? "Ish Beruvchi",
      sameAs: v.company?.website ?? undefined,
      logo: v.company?.logo_url ?? undefined,
    },
    jobLocation: {
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        streetAddress: v.address ?? undefined,
        addressLocality: v.district?.name_uz ?? v.region?.name_uz ?? undefined,
        addressRegion: v.region?.name_uz ?? undefined,
        addressCountry: "UZ",
      },
      geo: v.lat !== null && v.lng !== null ? { "@type": "GeoCoordinates", latitude: v.lat, longitude: v.lng } : undefined,
    },
    jobLocationType: v.is_remote ? "TELECOMMUTE" : undefined,
    applicantLocationRequirements: v.is_remote ? { "@type": "Country", name: "Uzbekistan" } : undefined,
    baseSalary: hasSalary
      ? {
          "@type": "MonetaryAmount",
          currency: "UZS",
          value: {
            "@type": "QuantitativeValue",
            minValue: v.salary_from ?? undefined,
            maxValue: v.salary_to ?? undefined,
            value: v.salary_from && v.salary_to && v.salary_from === v.salary_to ? v.salary_from : undefined,
            unitText: UNIT[v.salary_type],
          },
        }
      : undefined,
    experienceRequirements:
      v.experience_min_months > 0 ? { "@type": "OccupationalExperienceRequirements", monthsOfExperience: v.experience_min_months } : undefined,
    experienceInPlaceOfEducation: v.experience_min_months === 0 ? true : undefined,
    educationRequirements: v.education_min ? { "@type": "EducationalOccupationalCredential", credentialCategory: EDUCATION[v.education_min] } : undefined,
    skills: v.skills.length ? v.skills.map((s) => s.name_uz).join(", ") : undefined,
    industry: v.category?.name_uz ?? undefined,
  };
  // JSON.stringify undefined maydonlarni tashlab yuboradi; "<" ni escape qilamiz (script-ichi xavfsizligi)
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
