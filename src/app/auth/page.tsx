import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getT } from "@/lib/i18n/server";
import { getServerEnv } from "@/lib/env";
import { safeInternalPath } from "@/lib/security/safe-path";
import { getMode } from "@/features/mode/server";
import { LoginMethods } from "@/features/auth/components/auth-form";
import { phoneLoginHref } from "@/features/entry/auth-links";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("auth.title"), robots: { index: false } };
}

/**
 * 6-ekran: kirish usuli (telefon / Telegram). `?next=` — kirgandan keyin qaytiladigan joy (yo'q bo'lsa — /start: yangi
 * foydalanuvchi rol va profilga, qaytgan — bosh sahifasiga). `?phone=` (e'lon formasida yozilgan raqam) — to'g'ridan-to'g'ri
 * raqam ekraniga, qayta yozdirmasdan.
 */
export default async function AuthPage({ searchParams }: { searchParams: Promise<{ next?: string; phone?: string }> }) {
  const [mode, { next: rawNext, phone }] = await Promise.all([getMode(), searchParams]);
  const next = safeInternalPath(rawNext, "") || "/start";
  const phoneHref = phoneLoginHref({ next, mode, phone: phone && /^\+998\d{9}$/.test(phone) ? phone : null });
  if (phone && /^\+998\d{9}$/.test(phone) && mode) redirect(phoneHref);
  const botUsername = getServerEnv().TELEGRAM_BOT_USERNAME?.replace(/^@/, "") || null;
  return <LoginMethods next={next} phoneHref={phoneHref} botUsername={botUsername} backHref="/" />;
}
