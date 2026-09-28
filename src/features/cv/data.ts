import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type { Locale } from "@/lib/i18n/config";
import { localizedName, makeT, makeTEnum } from "@/lib/i18n/translate";
import { formatDate, formatMoney, formatPhone } from "@/lib/format";
import { ageFrom, formatExperienceRange, formatYearRange } from "@/features/profile/pure";
import type { CvPdfData, CvPdfItem } from "./pdf";

type Client = SupabaseClient<Database>;

/**
 * Ishchi profilidan PDF CV ma'lumoti. Client — foydalanuvchi (RLS) yoki bot uchun service role.
 * Telefon faqat `includePhone` bo'lsa (egasining o'zi so'raganda) qo'shiladi.
 */
export async function buildCvData(client: Client, workerId: string, locale: Locale, opts: { includePhone: boolean }): Promise<CvPdfData | null> {
  const t = makeT(locale);
  const tEnum = makeTEnum(t);
  const nm = (r: { name_uz: string; name_ru: string; name_en?: string | null } | null | undefined) => localizedName(locale, r);

  const { data: w } = await client
    .from("worker_profiles")
    .select(
      "id, profile_id, headline, about, experience_level, category:categories(name_uz, name_ru), subcategory:subcategories(name_uz, name_ru), region:regions(name_uz, name_ru), district:districts!worker_profiles_district_id_fkey(name_uz, name_ru)",
    )
    .eq("id", workerId)
    .maybeSingle();
  if (!w) return null;

  const [profile, contacts, telegram, prefs, skills, languages, experience, education] = await Promise.all([
    client.from("profiles").select("first_name, last_name, birth_date").eq("id", w.profile_id).maybeSingle(),
    client.from("profile_contacts").select("phone, email, telegram_username").eq("profile_id", w.profile_id).maybeSingle(),
    client.from("telegram_accounts").select("username").eq("profile_id", w.profile_id).maybeSingle(),
    client.from("worker_preferences").select("*").eq("worker_id", workerId).maybeSingle(),
    client.from("worker_skills").select("level, skill:skills(name_uz, name_ru)").eq("worker_id", workerId),
    client.from("worker_languages").select("level, language_code, language:languages(name_uz, name_ru)").eq("worker_id", workerId),
    client.from("worker_experience").select("*").eq("worker_id", workerId).order("is_current", { ascending: false }).order("started_on", { ascending: false }),
    client.from("worker_education").select("*").eq("worker_id", workerId).order("ended_year", { ascending: false, nullsFirst: false }),
  ]);

  const p = profile.data;
  const name = [p?.first_name, p?.last_name].filter(Boolean).join(" ").trim() || "—";
  const age = ageFrom(p?.birth_date ?? null);
  const place = [nm(w.district), nm(w.region)].filter(Boolean).join(", ");
  const facts = [age ? t("cv.pdf.age", { age }) : null, place || null, tEnum("experience_level", w.experience_level)].filter((x): x is string => !!x);

  const tg = contacts.data?.telegram_username || telegram.data?.username;
  const contactList = [
    opts.includePhone && contacts.data?.phone ? `${t("cv.pdf.phone")}: ${formatPhone(contacts.data.phone)}` : null,
    tg ? `Telegram: @${tg}` : null,
    contacts.data?.email ? `Email: ${contacts.data.email}` : null,
  ].filter((x): x is string => !!x);

  const sections: CvPdfData["sections"] = [];
  if (w.about?.trim()) sections.push({ title: t("cv.pdf.about"), items: [{ kind: "text", text: w.about.trim() }] });

  const exp: CvPdfItem[] = (experience.data ?? []).map((e) => ({
    kind: "entry",
    title: e.position,
    subtitle: e.company_name,
    period: formatExperienceRange(e.started_on, e.ended_on, e.is_current, locale, t("cv.pdf.present")),
    body: [e.responsibilities, e.achievements].filter(Boolean).join("\n") || null,
  }));
  sections.push({ title: t("cv.pdf.experience"), items: exp.length ? exp : [{ kind: "text", text: tEnum("experience_level", w.experience_level) }] });

  const skillNames = (skills.data ?? []).map((s) => nm(s.skill)).filter(Boolean);
  if (skillNames.length) sections.push({ title: t("cv.pdf.skills"), items: [{ kind: "chips", items: skillNames }] });

  const langs = (languages.data ?? []).map((l) => `${nm(l.language) || l.language_code} — ${tEnum("language_level", l.level)}`);
  if (langs.length) sections.push({ title: t("cv.pdf.languages"), items: [{ kind: "chips", items: langs }] });

  const edu: CvPdfItem[] = (education.data ?? []).map((e) => ({
    kind: "entry",
    title: e.institution || tEnum("education_level", e.level),
    subtitle: (e.institution ? [tEnum("education_level", e.level), e.field] : [e.field]).filter(Boolean).join(" · ") || null,
    period: formatYearRange(e.started_year, e.ended_year) || null,
  }));
  if (edu.length) sections.push({ title: t("cv.pdf.education"), items: edu });

  const pr = prefs.data;
  if (pr) {
    const pairs: [string, string][] = [];
    const salary = pr.salary_expected ?? pr.salary_min;
    if (salary) pairs.push([t("cv.pdf.salary"), `${formatMoney(salary, locale)} · ${tEnum("salary_type", pr.salary_type)}`]);
    if (pr.employment_types.length) pairs.push([t("cv.pdf.employment"), pr.employment_types.map((v) => tEnum("employment_type", v)).join(", ")]);
    if (pr.schedules.length) pairs.push([t("cv.pdf.schedule"), pr.schedules.map((v) => tEnum("work_schedule", v)).join(", ")]);
    pairs.push([t("cv.pdf.availability"), tEnum("availability", pr.availability)]);
    sections.push({ title: t("cv.pdf.preferences"), items: [{ kind: "pairs", pairs }] });
  }

  return {
    name,
    headline: w.headline || nm(w.subcategory) || nm(w.category),
    profession: [nm(w.category), nm(w.subcategory)].filter(Boolean).join(" · ") || null,
    facts,
    contacts: contactList,
    sections,
    footer: t("cv.pdf.footer", { date: formatDate(new Date(), locale) }),
  };
}

/** Fayl nomi: "CV-Aziza-Karimova.pdf" (lotin harflari) */
export function cvFileName(name: string): string {
  const safe = name
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 60);
  return `CV-${safe || "Ish-beruvchi"}.pdf`;
}
