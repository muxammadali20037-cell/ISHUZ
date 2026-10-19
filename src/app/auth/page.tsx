import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getT } from "@/lib/i18n/server";
import { getServerEnv } from "@/lib/env";
import { safeInternalPath } from "@/lib/security/safe-path";
import { getMode } from "@/features/mode/server";
import { LoginMethods } from "@/features/auth/components/auth-form";
import { phoneLoginHref } from "@/features/entry/auth-links";
import { RoleScreen } from "@/features/entry/components/role-screen";
import { isAdminPath } from "@/lib/admin-host";
import { adminUiEnabled } from "@/lib/features";
import { ADMIN_LOGIN_PATH } from "@/features/auth/admin-login";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("auth.title"), robots: { index: false } };
}

/**
 * 6-ekran: kirish usuli (telefon / Telegram; admin panelga kirishda — yana email + parol). `?next=` — kirgandan keyin qaytiladigan joy (yo'q bo'lsa — /start: yangi
 * foydalanuvchi rol va profilga, qaytgan — bosh sahifasiga). `?phone=` (e'lon formasida yozilgan raqam) — to'g'ridan-to'g'ri
 * raqam ekraniga, qayta yozdirmasdan.
 *
 * Har kirishda avval rol so'raladi (oxirgi tanlov belgilangan): kirgandan keyin ilova shu rolda ochiladi, almashtirgich yo'q.
 * Manzil o'zgarmaydi (/auth?next=…): birinchi ko'rinish — rol, tanlangach `?role=1` bilan kirish usuli. So'ralmaydi: admin
 * panelga kirishda va e'lon formasidan kelganda (rol formadan ma'lum, raqam yozilgan). `?role=1` faqat ekranlar tartibi
 * uchun — hech qanday ruxsat bermaydi.
 */
export default async function AuthPage({ searchParams }: { searchParams: Promise<{ next?: string; phone?: string; role?: string }> }) {
  const [mode, { next: rawNext, phone: rawPhone, role }] = await Promise.all([getMode(), searchParams]);
  const next = safeInternalPath(rawNext, "") || "/start";
  const phone = rawPhone && /^\+998\d{9}$/.test(rawPhone) ? rawPhone : null;
  const phoneHref = phoneLoginHref({ next, mode, phone });
  if (phone && mode) redirect(phoneHref);
  // admin panelga kirish: "orqaga" va "kirmasdan ko'rish" yo'q (alohida admin domenida ommaviy sahifalar ochilmaydi)
  const adminLogin = isAdminPath(next.split("?")[0] ?? "");
  if (!adminLogin && role !== "1") {
    const after = new URLSearchParams({ next, role: "1", ...(phone ? { phone } : {}) });
    return <RoleScreen mode={mode} next={`/auth?${after.toString()}`} backHref="/" />;
  }
  const botUsername = getServerEnv().TELEGRAM_BOT_USERNAME?.replace(/^@/, "") || null;
  return (
    <LoginMethods
      next={next}
      phoneHref={phoneHref}
      botUsername={botUsername}
      backHref={adminLogin ? null : "/"}
      showBrowse={!adminLogin}
      adminEmailHref={adminLogin && adminUiEnabled() ? `${ADMIN_LOGIN_PATH}?next=${encodeURIComponent(next)}` : null}
    />
  );
}
