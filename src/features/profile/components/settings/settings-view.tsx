import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { getT } from "@/lib/i18n/server";
import { getServerEnv } from "@/lib/env";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/misc";
import { LanguageSwitcher } from "@/components/shared/language-switcher";
import type { SessionContext } from "@/features/auth/session";
import { THEME_COOKIE, themeFromCookie } from "../../pure";
import { getMyContactGrants, getMyContacts, getMyTelegram } from "../../queries";
import { AccountCard } from "./account-card";
import { ContactGrantsList } from "./contact-grants-list";
import { PhoneVisibilityForm } from "./phone-visibility-form";
import { RoleSwitch } from "./role-switch";
import { TelegramCard } from "./telegram-card";
import { ThemeSelector } from "./theme-selector";
import { getIncomingContactRequests } from "@/features/contacts/queries";
import { IncomingContactRequests } from "@/features/contacts/incoming-requests";

function SettingsCard({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export async function SettingsView({ session }: { session: SessionContext }) {
  const { t } = await getT();
  const [contacts, grants, telegram, cookieStore, requests] = await Promise.all([
    getMyContacts(session.userId),
    getMyContactGrants(session.userId),
    getMyTelegram(session.userId),
    cookies(),
    getIncomingContactRequests(),
  ]);
  const theme = themeFromCookie(cookieStore.get(THEME_COOKIE)?.value);
  const botUsername = getServerEnv().TELEGRAM_BOT_USERNAME ?? null;

  return (
    <div className="container-narrow space-y-4 py-4 sm:py-6">
      <PageHeader title={t("profile.settings.title")} backHref="/profile" />

      <SettingsCard title={t("profile.settings.language")} description={t("profile.settings.language_hint")}>
        <LanguageSwitcher size="md" />
      </SettingsCard>

      {requests.length ? (
        <div id="contact-requests" className="scroll-mt-20">
          <SettingsCard title={t("contacts.incoming.title")} description={t("contacts.incoming.hint")}>
            <IncomingContactRequests items={requests} />
          </SettingsCard>
        </div>
      ) : null}

      <SettingsCard title={t("profile.settings.phone_privacy")} description={t("profile.settings.phone_privacy_hint")}>
        <PhoneVisibilityForm value={contacts?.phone_visibility ?? "applicants"} />
      </SettingsCard>

      <SettingsCard title={t("profile.settings.contact_grants")} description={t("profile.settings.contact_grants_hint")}>
        <ContactGrantsList grants={grants} />
      </SettingsCard>

      <SettingsCard title={t("profile.settings.theme")} description={t("profile.settings.theme_hint")}>
        <ThemeSelector initial={theme} />
      </SettingsCard>

      <SettingsCard title={t("profile.settings.telegram")}>
        <TelegramCard linked={telegram} botUsername={botUsername} />
      </SettingsCard>

      {session.roles.length ? (
        <SettingsCard title={t("profile.settings.role")} description={t("profile.settings.role_hint")}>
          <RoleSwitch roles={session.roles} activeRole={session.activeRole} />
        </SettingsCard>
      ) : null}

      <SettingsCard title={t("profile.settings.account")}>
        <AccountCard phone={contacts?.phone ?? null} phoneVerified={!!contacts?.phone_verified_at} email={contacts?.email ?? null} />
      </SettingsCard>
    </div>
  );
}
