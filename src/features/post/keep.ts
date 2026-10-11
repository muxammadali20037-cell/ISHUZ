import type { Enums } from "@/types/database.types";
import { experienceToLevel, levelToExperience, type SimpleExperience } from "./types";

/**
 * Qisqa forma batafsil profilni buzmasin: foydalanuvchi o'zgartirmagan maydonda batafsil (aniqroq) qiymat qoladi.
 * - Tajriba: "1–3 yil" guruhi o'zgarmagan bo'lsa "2–3 yil" "1–2 yil"ga aylanmaydi.
 * - Sarlavha: kasb o'zgarmagan bo'lsa qo'lda yozilgan sarlavha ("Bosh buxgalter, 1C") kasb nomi bilan almashmaydi.
 * - Ish jadvali: birinchi jadval o'zgarmagan bo'lsa ro'yxatdagi qolganlari o'chmaydi (null — RPC mavjudini saqlaydi).
 * - Masofaviy: "any" (masofaviy ham, joyida ham) "yes/no"ga aylanmaydi.
 */
export interface ExistingWorker {
  profession_node_id: string | null;
  custom_profession: string | null;
  headline: string | null;
  experience_level: Enums<"experience_level"> | null;
  remote_preference: Enums<"remote_preference"> | null;
  schedules: Enums<"work_schedule">[] | null;
}

export interface SimpleWorkerChoice {
  professionNodeId: string | null;
  customText: string | null;
  headline: string | null;
  experience: SimpleExperience;
  schedule: Enums<"work_schedule"> | null;
  remoteOk: boolean;
}

export function keptWorkerFields(existing: ExistingWorker | null, v: SimpleWorkerChoice) {
  const experience_level =
    existing?.experience_level && levelToExperience(existing.experience_level) === v.experience ? existing.experience_level : experienceToLevel(v.experience);
  const sameProfession =
    !!existing && ((!!v.professionNodeId && existing.profession_node_id === v.professionNodeId) || (!!v.customText && existing.custom_profession === v.customText));
  const headline = sameProfession && existing!.headline?.trim() ? existing!.headline : v.headline;
  const schedule = existing?.schedules?.length && v.schedule === existing.schedules[0] ? null : v.schedule;
  const remote_preference: Enums<"remote_preference"> | null = existing?.remote_preference === "any" && v.remoteOk ? "any" : null;
  return { experience_level, headline, schedule, remote_preference };
}
