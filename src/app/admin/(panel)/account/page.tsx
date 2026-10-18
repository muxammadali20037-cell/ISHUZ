import type { Metadata } from "next";
import { CheckCircle2, KeyRound, Send, ShieldCheck } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminContext } from "@/features/admin/context";
import { AdminPageHeader } from "@/features/admin/components/notes";
import { LoginMethodsForm } from "@/features/admin/components/login-methods-form";
import { ADMIN_LOGIN_PATH, isTechnicalEmail } from "@/features/auth/admin-login";
import { adminBaseUrl } from "@/features/auth/admin-password";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: `${t("admin.nav.account")} · ${t("admin.shell.title")}` };
}

/**
 * Kirish usullari (har bir admin — faqat o'zi uchun): Telegram/telefon, zaxira email + parol, har safar autentifikator kodi.
 * `?setup=1` — emaildagi havola orqali kelgan: parol o'rnatish taklifi.
 */
export default async function AdminAccountPage({ searchParams }: { searchParams: Promise<{ setup?: string }> }) {
  const ctx = await getAdminContext();
  const [{ t }, { setup }] = await Promise.all([getT(), searchParams]);
  const admin = createAdminClient();
  // Auth API parol borligini bildirmaydi — panelda o'rnatilgani audit yozuvidan (email havola bilan biriktirilgan bo'lishi mumkin)
  const [{ data }, { count: passwordSets }] = await Promise.all([
    admin.auth.admin.getUserById(ctx.session.userId),
    admin.from("audit_logs").select("id", { count: "exact", head: true }).eq("action", "admin.login_credentials_set").eq("target_id", ctx.session.userId),
  ]);
  const email = data.user?.email ?? null;
  const hasEmail = !isTechnicalEmail(email);
  const hasPassword = hasEmail && (passwordSets ?? 0) > 0;
  const loginUrl = `${adminBaseUrl()}${ADMIN_LOGIN_PATH}`;
  const methods = [
    { icon: Send, text: t("admin.account.method_telegram"), on: true },
    { icon: KeyRound, text: t("admin.account.method_password"), on: hasPassword },
    { icon: ShieldCheck, text: t("admin.account.method_totp"), on: true },
  ];

  return (
    <div className="max-w-2xl space-y-6">
      <AdminPageHeader title={t("admin.account.title")} subtitle={t("admin.account.subtitle")} />
      {setup === "1" ? <p className="rounded-xl bg-primary-soft p-3 text-sm font-medium text-primary">{t("admin.account.setup_hint")}</p> : null}
      <section className="rounded-2xl border border-border/70 bg-card p-4">
        <h2 className="text-base font-semibold">{t("admin.account.methods")}</h2>
        <ul className="mt-3 space-y-2">
          {methods.map((m) => (
            <li key={m.text} className="flex items-center gap-3 text-sm">
              <m.icon className="size-5 shrink-0 text-muted-foreground" aria-hidden />
              <span className="min-w-0 flex-1">{m.text}</span>
              {m.on ? (
                <CheckCircle2 className="size-5 shrink-0 text-success" aria-label={t("admin.account.on")} />
              ) : (
                <span className="text-xs font-semibold text-muted-foreground">{t("admin.account.off")}</span>
              )}
            </li>
          ))}
        </ul>
        <dl className="mt-4 grid gap-1 border-t border-border/70 pt-3 text-sm">
          <dt className="text-muted-foreground">{t("admin.account.current_email")}</dt>
          <dd className="font-medium break-all" data-testid="login-email">{hasEmail ? email : t("admin.account.no_email")}</dd>
          <dt className="mt-2 text-muted-foreground">{t("admin.account.login_url")}</dt>
          <dd className="font-mono text-xs break-all">{loginUrl}</dd>
        </dl>
      </section>
      <section className="rounded-2xl border border-border/70 bg-card p-4">
        <h2 className="mb-3 text-base font-semibold">{t("admin.account.form_title")}</h2>
        <LoginMethodsForm initialEmail={hasEmail && email ? email : ""} />
      </section>
    </div>
  );
}
