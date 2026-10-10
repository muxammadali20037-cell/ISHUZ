import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getLocale, getT } from "@/lib/i18n/server";
import { I18nProvider } from "@/lib/i18n/client";
import { clientMessages } from "@/lib/i18n/translate";
import { adminUiEnabled } from "@/lib/features";
import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/features/auth/session";
import { MfaForm } from "@/features/admin/components/mfa-form";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("admin.mfa.title"), robots: { index: false, follow: false } };
}

/**
 * Admin uchun ikki bosqichli kirish (TOTP). Admin huquqlari faqat aal2 sessiyada ishlaydi —
 * buni baza (has_admin_permission → admin_aal_ok) tekshiradi; bu sahifa faqat kodni kiritish uchun.
 */
export default async function AdminMfaPage() {
  if (!adminUiEnabled()) notFound();
  const session = await requireSession("/admin/mfa");
  const supabase = await createClient();
  const { data } = await supabase.rpc("my_admin_status");
  const status = (data ?? {}) as { is_staff?: boolean; aal_ok?: boolean };
  // admin bo'lmaganlarga sahifa borligini ham bildirmaymiz
  if (!status.is_staff || session.profile.is_blocked) notFound();
  if (status.aal_ok) redirect("/admin");
  const locale = await getLocale();
  return (
    <I18nProvider locale={locale} messages={clientMessages(locale, { admin: true })}>
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-10">
        <MfaForm />
      </main>
    </I18nProvider>
  );
}
