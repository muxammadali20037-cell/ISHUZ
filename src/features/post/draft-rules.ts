import { SCHEDULES, SIMPLE_EMPLOYER_TYPES, SIMPLE_EXPERIENCE, VACANCY_EXPERIENCE, type VacancyDraft, type WorkerDraft } from "./types";
import { isBool, isCustomProfession, isId, isPickedProfession, isPlace, isStep, isStr, oneOf, type DraftRules } from "./draft-store";

/** Qurilmada saqlangan qoralama maydonlarini tekshirish (zod'siz — forma brauzerga yengil yuklansin) */

const isSchedule = (v: unknown) => v === "" || (SCHEDULES as unknown[]).includes(v);
const isSource = (v: unknown) => v === undefined || v === "manual" || v === "ai";
const PHOTO_PATH = /^[0-9a-f-]{36}\/(?:[0-9a-f-]{36}\.(?:jpg|png|webp)|v-[0-9a-f]{64}\.webp)$/;
/** "Izoh" bandlari: ko'pi bilan 8 ta, har biri 80 belgigacha */
const isNotes = (x: unknown) => x === undefined || (Array.isArray(x) && x.length <= 8 && x.every((i) => typeof i === "string" && i.length <= 80));
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** tekshirish sahifasidagi AI rasm qoralamasi: id va https manzil (boshqasi — qabul qilinmaydi) */
const isImage = (x: unknown) =>
  x === undefined ||
  x === null ||
  (typeof x === "object" && typeof (x as { draft?: unknown }).draft === "string" && UUID.test((x as { draft: string }).draft) && typeof (x as { url?: unknown }).url === "string" && /^https:\/\/\S{1,500}$/.test((x as { url: string }).url));

export const WORKER_DRAFT_RULES: DraftRules<WorkerDraft> = {
  v: (x) => x === 1,
  step: isStep(4),
  profession: isPickedProfession,
  custom: (x) => x === undefined || isCustomProfession(x),
  place: isPlace,
  remoteOk: isBool,
  firstName: isStr(60),
  lastName: isStr(60),
  phone: isStr(20),
  about: isStr(1000),
  experience: (x) => x === null || (SIMPLE_EXPERIENCE as unknown[]).includes(x),
  salary: isStr(20),
  schedule: isSchedule,
  showPhone: isBool,
  source: isSource,
  image: isImage,
};

/** Tahrirlanayotgan vakansiya qoralamasi faqat o'sha vakansiyaga tegishli bo'lsa qabul qilinadi */
export function vacancyDraftRules(editId: string | null): DraftRules<VacancyDraft> {
  return {
    v: (x) => x === 1,
    step: isStep(4),
    clientRef: isId,
    editId: (x) => x === editId,
    profession: isPickedProfession,
    custom: (x) => x === undefined || isCustomProfession(x),
    place: isPlace,
    employerType: (x) => x === null || (SIMPLE_EMPLOYER_TYPES as unknown[]).includes(x),
    orgName: isStr(120),
    phone: isStr(20),
    description: isStr(4000),
    salaryFrom: isStr(20),
    salaryTo: isStr(20),
    negotiable: isBool,
    title: isStr(120),
    schedule: isSchedule,
    experienceMonths: oneOf(VACANCY_EXPERIENCE),
    salaryType: (x) => x === undefined || oneOf(["monthly", "daily", "hourly", "piecework"])(x),
    showPhone: isBool,
    photoPath: (x) => x === undefined || x === null || (typeof x === "string" && PHOTO_PATH.test(x)),
    source: isSource,
    image: isImage,
    notes: isNotes,
  };
}
