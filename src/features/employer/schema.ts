import { z } from "zod";
import { normalizePhone } from "@/lib/format";

/** Ish beruvchi moduli: zod sxemalar va normalizatorlar (client va server bir xil). */

export const EMPLOYER_TYPES = ["company", "government", "individual_entrepreneur", "person"] as const;
/** Tashkilot sahifasi (companies) bilan ishlaydigan turlar */
export const COMPANY_EMPLOYER_TYPES = ["company", "government", "individual_entrepreneur"] as const;
export const COMPANY_SIZES = ["1_10", "11_50", "51_200", "201_500", "500_plus"] as const;
export const ASSIGNABLE_MEMBER_ROLES = ["admin", "recruiter", "viewer"] as const;
export const COMPANY_VERIFICATION_TYPES = ["company", "tin", "documents"] as const;
export const PERSON_VERIFICATION_TYPES = ["identity"] as const;
export const VERIFICATION_TYPES = [...COMPANY_VERIFICATION_TYPES, ...PERSON_VERIFICATION_TYPES] as const;

export const LOGO_MAX_BYTES = 3 * 1024 * 1024;
export const LOGO_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};
export const DOC_MAX_BYTES = 15 * 1024 * 1024;
export const DOC_MAX_COUNT = 5;
export const DOC_MIME: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
};

// ---------- normalizatorlar (pure) ----------

/** "@user", "t.me/user", "https://t.me/user" → "@user"; noto'g'ri bo'lsa null; bo'sh bo'lsa "" */
export function normalizeTelegram(input: string): string | null {
  const v = input.trim();
  if (!v) return "";
  const u = v
    .replace(/^https?:\/\//i, "")
    .replace(/^(www\.)?t\.me\//i, "")
    .replace(/^@/, "")
    .replace(/\/+$/, "");
  return /^[a-zA-Z][a-zA-Z0-9_]{4,31}$/.test(u) ? `@${u}` : null;
}

/** "@user", "instagram.com/user/" → "user"; noto'g'ri bo'lsa null; bo'sh bo'lsa "" */
export function normalizeInstagram(input: string): string | null {
  const v = input.trim();
  if (!v) return "";
  const u = v
    .replace(/^https?:\/\//i, "")
    .replace(/^(www\.)?instagram\.com\//i, "")
    .replace(/^@/, "")
    .replace(/[/?#].*$/, "");
  return /^[a-zA-Z0-9._]{1,30}$/.test(u) ? u : null;
}

/** "example.uz" → "https://example.uz"; noto'g'ri bo'lsa null; bo'sh bo'lsa "" */
export function normalizeWebsite(input: string): string | null {
  const v = input.trim();
  if (!v) return "";
  const candidate = /^https?:\/\//i.test(v) ? v : `https://${v}`;
  try {
    const url = new URL(candidate);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (!/\.[a-z]{2,}$/i.test(url.hostname)) return null;
    const href = url.toString();
    return url.pathname === "/" && !url.search && !url.hash ? href.replace(/\/$/, "") : href;
  } catch {
    return null;
  }
}

export function telegramUrl(handle: string | null | undefined): string | null {
  if (!handle) return null;
  return `https://t.me/${handle.replace(/^@/, "")}`;
}

export function instagramUrl(username: string | null | undefined): string | null {
  if (!username) return null;
  return `https://instagram.com/${username}`;
}

/** Logotip fayli tekshiruvi → xato i18n kaliti yoki null */
export function validateLogoFile(file: { type: string; size: number }): string | null {
  if (!LOGO_MIME[file.type]) return "employer.form.errors.logo_type";
  if (file.size > LOGO_MAX_BYTES) return "employer.form.errors.logo_size";
  return null;
}

/** Hujjat fayli tekshiruvi → xato i18n kaliti yoki null */
export function validateDocumentFile(file: { type: string; size: number }): string | null {
  if (!DOC_MIME[file.type]) return "employer.verification.errors.doc_type";
  if (file.size > DOC_MAX_BYTES) return "employer.verification.errors.doc_size";
  return null;
}

// ---------- zod yordamchilar ----------

/**
 * Forma qiymatlari ikki marta tekshiriladi: client (zodResolver → natija: "" o'rniga null) va server action.
 * Shuning uchun har bir maydon null/undefined ni ham qabul qiladi ("" deb qaraladi) — sxema idempotent.
 */
const text = () => z.string().nullish().transform((v) => v ?? "");

const optionalText = (max: number, maxMessage: string) =>
  text()
    .pipe(z.string().trim().max(max, maxMessage))
    .transform((v) => (v === "" ? null : v));

const uuidOrNull = text()
  .transform((v) => v.trim())
  .transform((v) => (v === "" ? null : v))
  .pipe(z.uuid("common.errors.validation").nullable());

const phoneField = text()
  .transform((v) => v.trim())
  .transform((v, ctx) => {
    if (!v) return null;
    const n = normalizePhone(v);
    if (!n) {
      ctx.addIssue({ code: "custom", message: "common.errors.invalid_phone" });
      return z.NEVER;
    }
    return n;
  });

const telegramField = text().transform((v, ctx) => {
  const n = normalizeTelegram(v);
  if (n === null) {
    ctx.addIssue({ code: "custom", message: "employer.form.errors.telegram" });
    return z.NEVER;
  }
  return n || null;
});

const instagramField = text().transform((v, ctx) => {
  const n = normalizeInstagram(v);
  if (n === null) {
    ctx.addIssue({ code: "custom", message: "employer.form.errors.instagram" });
    return z.NEVER;
  }
  return n || null;
});

const websiteField = text().transform((v, ctx) => {
  const n = normalizeWebsite(v);
  if (n === null) {
    ctx.addIssue({ code: "custom", message: "common.errors.invalid_url" });
    return z.NEVER;
  }
  return n || null;
});

const tinField = text()
  .transform((v) => v.trim())
  .transform((v, ctx) => {
    const digits = v.replace(/\s/g, "");
    if (!digits) return null;
    if (!/^[0-9]{9}$/.test(digits)) {
      ctx.addIssue({ code: "custom", message: "employer.form.errors.tin" });
      return z.NEVER;
    }
    return digits;
  });

const sizeField = text()
  .transform((v) => (v === "" ? null : v))
  .pipe(z.enum(COMPANY_SIZES).nullable());

// ---------- sxemalar ----------

export const employerTypeSchema = z.object({ employerType: z.enum(EMPLOYER_TYPES) });
export type EmployerTypeInput = z.infer<typeof employerTypeSchema>;

export const companySchema = z.object({
  name: z.string().trim().min(2, "employer.form.errors.name_length").max(120, "employer.form.errors.name_length"),
  phone: phoneField,
  telegram: telegramField,
  website: websiteField,
  instagram: instagramField,
  address: optionalText(200, "employer.form.errors.address_max"),
  regionId: uuidOrNull,
  districtId: uuidOrNull,
  industryCategoryId: uuidOrNull,
  about: optionalText(2000, "employer.form.errors.about_max"),
  size: sizeField,
  tin: tinField,
});
export type CompanyFormInput = z.input<typeof companySchema>;
export type CompanyFormValues = z.output<typeof companySchema>;

export const personSchema = z.object({
  displayName: z.string().trim().min(2, "employer.form.errors.display_name_length").max(80, "employer.form.errors.display_name_length"),
  contactPhone: phoneField,
  regionId: uuidOrNull,
  districtId: uuidOrNull,
  about: optionalText(2000, "employer.form.errors.about_max"),
});
export type PersonFormInput = z.input<typeof personSchema>;
export type PersonFormValues = z.output<typeof personSchema>;

/** Qadamlar orasida avtosaqlash (barcha maydonlar ixtiyoriy) */
export const employerDraftSchema = z.object({
  displayName: optionalText(80, "employer.form.errors.display_name_length"),
  contactPhone: phoneField,
  regionId: uuidOrNull,
  districtId: uuidOrNull,
  about: optionalText(2000, "employer.form.errors.about_max"),
});
export type EmployerDraftInput = z.input<typeof employerDraftSchema>;

export const completeCompanyOnboardingSchema = companySchema.extend({ employerType: z.enum(COMPANY_EMPLOYER_TYPES) });
export type CompleteCompanyOnboardingInput = z.input<typeof completeCompanyOnboardingSchema>;

export const updateCompanySchema = companySchema.extend({ companyId: z.uuid() });
export type UpdateCompanyInput = z.input<typeof updateCompanySchema>;

export const saveCompanyLogoSchema = z.object({
  companyId: z.uuid(),
  /** storage yo'li: <companyId>/logo.<ext> yoki null (o'chirish) */
  path: z.string().min(1).max(200).nullable(),
});
export type SaveCompanyLogoInput = z.infer<typeof saveCompanyLogoSchema>;

export const setMemberRoleSchema = z.object({
  companyId: z.uuid(),
  profileId: z.uuid(),
  role: z.enum(ASSIGNABLE_MEMBER_ROLES),
});
export type SetMemberRoleInput = z.infer<typeof setMemberRoleSchema>;

export const removeMemberSchema = z.object({ companyId: z.uuid(), profileId: z.uuid() });
export type RemoveMemberInput = z.infer<typeof removeMemberSchema>;

export const verificationRequestSchema = z.object({
  companyId: z.uuid().nullable(),
  type: z.enum(VERIFICATION_TYPES),
  note: optionalText(1000, "employer.form.errors.about_max"),
  documentPaths: z.array(z.string().min(1).max(300)).min(1, "employer.verification.documents_required").max(DOC_MAX_COUNT, "employer.verification.errors.doc_limit"),
});
export type VerificationRequestInput = z.input<typeof verificationRequestSchema>;

/** Logotip yo'li kompaniyaga tegishli va ruxsat etilgan kengaytmada ekanini tekshiradi */
export function isValidLogoPath(companyId: string, path: string): boolean {
  const allowed = Object.values(LOGO_MIME).join("|");
  return new RegExp(`^${companyId}/logo\\.(${allowed})$`).test(path);
}

/** Hujjat yo'li foydalanuvchiga tegishli ekanini tekshiradi: <userId>/<uuid>.<ext> */
export function isValidDocumentPath(userId: string, path: string): boolean {
  const allowed = Object.values(DOC_MIME).join("|");
  return new RegExp(`^${userId}/[0-9a-f-]{36}\\.(${allowed})$`).test(path);
}

// ---------- takliflar (company_invites) ----------

export const createInviteSchema = z.object({ companyId: z.uuid(), role: z.enum(ASSIGNABLE_MEMBER_ROLES) });
export type CreateInviteInput = z.infer<typeof createInviteSchema>;

export const deleteInviteSchema = z.object({ companyId: z.uuid(), inviteId: z.uuid() });
export type DeleteInviteInput = z.infer<typeof deleteInviteSchema>;

export const acceptInviteSchema = z.object({ token: z.string().trim().min(8).max(200) });
export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>;

/** Taklif havolasi: <appUrl>/company/join?token=... */
export function inviteLink(appUrl: string, token: string): string {
  return `${appUrl.replace(/\/$/, "")}/company/join?token=${encodeURIComponent(token)}`;
}
