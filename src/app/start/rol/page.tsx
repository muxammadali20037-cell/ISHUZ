import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { safeInternalPath } from "@/lib/security/safe-path";
import { getMode } from "@/features/mode/server";
import { RoleScreen } from "@/features/entry/components/role-screen";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("welcome.entry.role.title"), robots: { index: false } };
}

/**
 * 7-ekran: "O'z rolingizni tanlang". Kirishdan oldin (/auth birinchi qadami shu ko'rinish), kirgandan keyin (masalan, Telegram'dan
 * birinchi kirish) yoki Kabinetim → "Rolni o'zgartirish" — tanlovdan so'ng `next` ga (oqim davom etadi).
 */
export default async function RolePage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const [mode, sp] = await Promise.all([getMode(), searchParams]);
  const next = safeInternalPath(sp.next, "") || "/start";
  // raqam ekraniga ketayotgan bo'lsa — orqaga kirish usuliga (rol shu yerda tanlanadi, qayta so'ralmaydi); aks holda bosh sahifaga
  const phoneNext = next.startsWith("/auth/telefon") ? new URLSearchParams(next.split("?")[1] ?? "").get("next") : null;
  const backHref = next.startsWith("/auth/telefon") ? `/auth?${new URLSearchParams({ next: phoneNext || "/start", role: "1" }).toString()}` : "/";
  return <RoleScreen mode={mode} next={next} backHref={backHref} error={!!sp.error} />;
}
