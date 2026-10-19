import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { getServerEnv } from "@/lib/env";
import { safeInternalPath } from "@/lib/security/safe-path";
import { PhoneLogin } from "@/features/auth/components/auth-form";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("auth.phone.title"), robots: { index: false } };
}

/** 8–9-ekranlar: telefon raqam va Telegram orqali kelgan kod. Kirgan foydalanuvchi bu yerga kelmaydi (proxy → next) */
export default async function PhoneAuthPage({ searchParams }: { searchParams: Promise<{ next?: string; phone?: string }> }) {
  const { next: rawNext, phone } = await searchParams;
  const next = safeInternalPath(rawNext, "") || "/start";
  const botUsername = getServerEnv().TELEGRAM_BOT_USERNAME?.replace(/^@/, "") || null;
  return (
    <PhoneLogin
      next={next}
      botUsername={botUsername}
      initialPhone={phone && /^\+998\d{9}$/.test(phone) ? phone : null}
      // orqaga — kirish usuliga (rol shu kirishda allaqachon tanlangan, qayta so'ralmaydi)
      backHref={`/auth?${new URLSearchParams({ next, role: "1" }).toString()}`}
    />
  );
}
