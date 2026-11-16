import { redirect } from "next/navigation";

/**
 * 05 "Qaysi kasblar sizga mos keladi?" — olib tashlandi (ega, 2026-11-17: "kerak emas, umuman olib tashla"). Eski havolalar
 * (saqlangan sahifa, orqaga qaytish) bosh sahifaga olib boradi.
 */
export default function ProfessionsStepRemoved() {
  redirect("/");
}
