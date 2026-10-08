import type { Metadata } from "next";
import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import { LanguageSwitcher } from "@/components/shared/language-switcher";
import { AuthForm } from "@/features/auth/components/auth-form";
import { getServerEnv } from "@/lib/env";

export const metadata: Metadata = { title: "Kirish" };

export default async function AuthPage({ searchParams }: { searchParams: Promise<{ next?: string; phone?: string }> }) {
  const { t } = await getT();
  const { next, phone } = await searchParams;
  // e'lon formasida yozilgan raqam — qayta yozdirmaslik uchun oldindan to'ldiriladi
  const initialPhone = phone && /^\+998\d{9}$/.test(phone) ? phone : null;
  const botUsername = getServerEnv().TELEGRAM_BOT_USERNAME?.replace(/^@/, "") || null;
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "/";
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="container-narrow flex h-14 items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-extrabold tracking-tight">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-xs text-primary-foreground">IB</span>
          <span className="text-lg">
            Ish <span className="text-primary">Beruvchi</span>
          </span>
        </Link>
        <LanguageSwitcher />
      </header>
      <main className="container-narrow flex flex-1 flex-col justify-center py-8">
        <div className="mx-auto w-full max-w-sm">
          <h1 className="text-2xl font-bold">{t("auth.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("auth.subtitle")}</p>
          <div className="mt-6">
            <AuthForm next={safeNext} botUsername={botUsername} initialPhone={initialPhone} />
          </div>
        </div>
      </main>
    </div>
  );
}
