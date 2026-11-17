import { redirect } from "next/navigation";

/**
 * /dunyo — "Mening dunyom" olib tashlandi (ega, 2026-11-17: "kerak emas"). Eski havolalar (eslatmalar, xabarlar) Profilga
 * olib boradi. Bazadagi tanlangan qiziqishlar (profile_interests) o'chirilmadi.
 */
export default function WorldPage(): never {
  redirect("/cabinet");
}
