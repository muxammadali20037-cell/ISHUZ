import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { Constants } from "@/types/database.types";
import { AI_MODEL, getAiClient } from "@/lib/ai/client";
import type { Locale } from "@/lib/i18n/config";
import type { AiCatalog } from "./catalog";

const E = Constants.public.Enums;
const code = z.string().nullable();

// ---------------------------------------------------------------------------
// Sxemalar (structured outputs). Kodlar katalogdan; noma'lum bo'lsa null.
// ---------------------------------------------------------------------------

export const workerExtractSchema = z.object({
  first_name: z.string().nullable(),
  last_name: z.string().nullable(),
  birth_date: z.string().nullable().describe("YYYY-MM-DD, faqat to'liq sana aniq aytilgan bo'lsa"),
  gender: z.enum(E.gender).nullable(),
  region: code.describe("rN"),
  district: code.describe("dN"),
  extra_districts: z.array(z.string()).describe("dN — yana ishlashi mumkin bo'lgan tumanlar"),
  remote_preference: z.enum(E.remote_preference).nullable(),
  category: code.describe("cN"),
  subcategory: code.describe("sN"),
  headline: z.string().nullable().describe("Lavozim nomi, 2-80 belgi, masalan: Oshpaz, Yuk mashinasi haydovchisi"),
  about: z.string().nullable().describe("O'zi haqida qisqa, chiroyli matn (2-4 gap), foydalanuvchi tilida"),
  experience_level: z.enum(E.experience_level).nullable(),
  experience: z.array(
    z.object({
      company_name: z.string(),
      position: z.string(),
      started_on: z.string().nullable().describe("YYYY-MM"),
      ended_on: z.string().nullable().describe("YYYY-MM"),
      is_current: z.boolean(),
      responsibilities: z.string(),
    }),
  ),
  skills: z.array(z.object({ code: z.string().describe("kN"), level: z.enum(E.skill_level) })),
  languages: z.array(z.object({ code: z.string(), level: z.enum(E.language_level) })),
  education_level: z.enum(E.education_level).nullable(),
  education: z.array(z.object({ institution: z.string(), field: z.string() })),
  employment_types: z.array(z.enum(E.employment_type)),
  schedules: z.array(z.enum(E.work_schedule)),
  salary_min: z.number().int().nullable().describe("so'mda"),
  salary_expected: z.number().int().nullable().describe("so'mda"),
  salary_type: z.enum(E.salary_type).nullable(),
  availability: z.enum(E.availability).nullable(),
  work_format: z.enum(E.work_format).nullable(),
});
export type WorkerExtract = z.infer<typeof workerExtractSchema>;

export const vacancyExtractSchema = z.object({
  title: z.string().describe("Lavozim nomi, 2-120 belgi"),
  category: code.describe("cN"),
  subcategory: code.describe("sN"),
  is_remote: z.boolean(),
  region: code.describe("rN"),
  district: code.describe("dN"),
  address: z.string().nullable(),
  salary_negotiable: z.boolean(),
  salary_from: z.number().int().nullable().describe("so'mda"),
  salary_to: z.number().int().nullable().describe("so'mda"),
  salary_type: z.enum(E.salary_type),
  employment_type: z.enum(E.employment_type).nullable(),
  schedule: z.enum(E.work_schedule).nullable(),
  work_time_from: z.string().nullable().describe("HH:MM"),
  work_time_to: z.string().nullable().describe("HH:MM"),
  experience_min_months: z.number().int().describe("0, 6, 12, 24, 36 yoki 60"),
  age_min: z.number().int().nullable(),
  age_max: z.number().int().nullable(),
  education_min: z.enum(E.education_level).nullable(),
  gender: z.enum(E.gender).nullable(),
  languages: z.array(z.object({ code: z.string(), min_level: z.enum(E.language_level) })),
  skills: z.array(z.object({ code: z.string().describe("kN"), required: z.boolean() })),
  work_format: z.enum(E.work_format).nullable(),
  official_terms: z.array(z.string()),
  benefits: z.array(z.string()),
  description: z.string().describe("Chiroyli e'lon matni (markdown), foydalanuvchi tilida"),
});
export type VacancyExtract = z.infer<typeof vacancyExtractSchema>;

// ---------------------------------------------------------------------------
// Promptlar
// ---------------------------------------------------------------------------

const COMMON = `Sen Worklyn (O'zbekiston ish platformasi) yordamchisisan. Foydalanuvchi o'z so'zlari bilan, ba'zan xatolar bilan, o'zbek (lotin/kirill) yoki rus tilida yozadi.
Vazifang: matnni tahlil qilib, berilgan JSON sxemasi bo'yicha to'ldirish.
Qoidalar:
- Kategoriya, yo'nalish, viloyat, tuman, ko'nikma — FAQAT pastdagi ma'lumotnomadagi kodlar (c1, s5, r2, d17, k3). Mosi yo'q bo'lsa null (ko'nikma bo'lsa ro'yxatga qo'shma).
- Tuman berilsa, viloyat ham shu tumanning viloyati bo'lsin. "Toshkent" deyilsa va tuman aytilmasa — Toshkent shahri viloyati, tuman null.
- Maosh so'mda butun son: "3 mln" = 3000000, "500 ming" = 500000, "$500" ≈ 500 * 12800.
- Matnda yo'q narsani o'ylab topma — null yoki bo'sh ro'yxat qo'y. Faqat aniq xulosa qilinadigan narsani to'ldir.
- Yozadigan matnlaring (sarlavha, tavsif) toza, xatosiz va do'stona bo'lsin.`;

function localeName(locale: Locale) {
  return locale === "ru" ? "rus tilida" : "o'zbek tilida (lotin yozuvi)";
}

const WORKER_TASK = `Bu — ISH QIDIRUVCHI o'zi haqida yozgan matn. Profilini to'ldir.
- headline: qisqa lavozim nomi. about: 2-4 gaplik professional "o'zim haqimda".
- experience_level: umumiy tajriba (none, lt_6m, 6_12m, 1_2y, 2_3y, 3_5y, 5y_plus).
- languages: aytilgan tillar; aytilmasa o'zbek tili (uz) native deb ol.
- Ish joyi nomi aytilmagan tajribani experience ro'yxatiga qo'shma, faqat experience_level'ni to'ldir.`;

const VACANCY_TASK = `Bu — ISH BERUVCHI vakansiya haqida yozgan matn. Vakansiyani to'ldir.
- title: aniq lavozim nomi (masalan "Sotuvchi-konsultant").
- description: jozibali e'lon matni markdown'da: 1 gaplik kirish, keyin "**Vazifalar:**", "**Talablar:**", "**Biz taklif qilamiz:**" bo'limlari ro'yxat ko'rinishida. Har bo'lim oldiga mos emoji qo'y (📋 ✅ 🎁 💰 📍 🕘). Matnda yo'q faktlarni qo'shma, lekin ma'noni chiroyli ifodala. 1500 belgidan oshmasin.
- experience_min_months: 0, 6, 12, 24, 36, 60 dan eng yaqini. Maosh aytilmasa salary_negotiable = true.
- is_remote: faqat masofaviy ish bo'lsa true.`;

async function run<T extends z.ZodType>(schema: T, task: string, catalog: AiCatalog, text: string, locale: Locale): Promise<z.infer<T> | null> {
  const client = getAiClient();
  if (!client) return null;
  const response = await client.beta.messages.parse({
    model: AI_MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low", format: betaZodOutputFormat(schema) },
    system: [
      // Barqaror qism (qoidalar + ma'lumotnoma) — keshlanadi
      { type: "text", text: `${COMMON}\n\n# Ma'lumotnoma\n${catalog.text}`, cache_control: { type: "ephemeral" } },
      { type: "text", text: `${task}\nMatnlarni ${localeName(locale)} yoz.` },
    ],
    messages: [{ role: "user", content: text }],
  });
  if (response.stop_reason === "refusal") return null;
  return (response.parsed_output as z.infer<T> | null) ?? null;
}

export async function extractWorker(catalog: AiCatalog, text: string, locale: Locale): Promise<WorkerExtract | null> {
  return run(workerExtractSchema, WORKER_TASK, catalog, text, locale);
}

export async function extractVacancy(catalog: AiCatalog, text: string, locale: Locale): Promise<VacancyExtract | null> {
  return run(vacancyExtractSchema, VACANCY_TASK, catalog, text, locale);
}

export function isAiRateLimit(error: unknown): boolean {
  return error instanceof Anthropic.RateLimitError;
}
