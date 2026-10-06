import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";
import Script from "next/script";
import { cookies } from "next/headers";
import { getLocale, getT } from "@/lib/i18n/server";
import { getServerEnv } from "@/lib/env";
import { WelcomeGate } from "@/components/shared/welcome-gate";
import { WELCOME_COOKIE } from "@/components/shared/welcome-cookie";
import { LOCALE_COOKIE } from "@/lib/i18n/config";
import { Providers } from "./providers";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin", "cyrillic"],
  variable: "--font-manrope",
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

export async function generateMetadata(): Promise<Metadata> {
  const { t, locale } = await getT();
  const { GOOGLE_SITE_VERIFICATION, YANDEX_VERIFICATION } = getServerEnv();
  return {
    metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
    title: { default: t("common.meta.title"), template: "%s · Ish Beruvchi" },
    description: t("common.meta.description"),
    keywords: t("common.meta.keywords"),
    applicationName: "Ish Beruvchi",
    manifest: "/manifest.webmanifest",
    icons: { icon: [{ url: "/icon.svg", type: "image/svg+xml" }, { url: "/icons/favicon-48.png", sizes: "48x48", type: "image/png" }], apple: "/icons/apple-touch-icon.png" },
    openGraph: { type: "website", siteName: "Ish Beruvchi", locale: locale === "ru" ? "ru_RU" : locale === "en" ? "en_US" : "uz_UZ", alternateLocale: ["uz_UZ", "ru_RU", "en_US"].filter((l) => l !== (locale === "ru" ? "ru_RU" : locale === "en" ? "en_US" : "uz_UZ")) },
    appleWebApp: { capable: true, statusBarStyle: "default", title: "Ish Beruvchi" },
    verification: {
      google: GOOGLE_SITE_VERIFICATION,
      yandex: YANDEX_VERIFICATION,
    },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#1d5fe0" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1220" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const cookieStore = await cookies();
  const theme = cookieStore.get("ishuz_theme")?.value;
  const showWelcome = !cookieStore.has(WELCOME_COOKIE);
  return (
    <html lang={locale} className={`${manrope.variable} ${theme === "dark" ? "dark" : ""}`} suppressHydrationWarning>
      <head>
        {/* Telegram Mini App SDK: window.Telegram.WebApp (initData) gidratsiyadan oldin mavjud bo'lishi kerak */}
        <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
        {/* Mavzu: cookie yo'q ("system") bo'lsa — qurilma sozlamasiga qarab, gidratsiyadan oldin (miltillashsiz) */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var m=document.cookie.match(/(?:^|; )ishuz_theme=(dark|light)/);var d=m?m[1]==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.classList.toggle('dark',d);}catch(e){}})();`,
          }}
        />
      </head>
      <body className="font-sans">
        <Providers locale={locale}>
          {children}
          {showWelcome ? <WelcomeGate needLanguage={!cookieStore.has(LOCALE_COOKIE)} /> : null}
        </Providers>
      </body>
    </html>
  );
}
