import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";
import { cookies } from "next/headers";
import { getLocale, getT } from "@/lib/i18n/server";
import { clientMessages } from "@/lib/i18n/translate";
import { getServerEnv } from "@/lib/env";
import { CelebrationListener } from "@/components/shared/celebration-listener";
import { SPLASH_BOOT, Splash } from "@/components/shared/splash";
import { Providers } from "./providers";
import "./globals.css";
import { BRAND } from "@/config/brand";

/**
 * Telegram ichidamizmi: ishga tushirish manzilida #tgWebAppData..., keyingi sahifalarda SDK saqlagan
 * sessionStorage "__telegram__initParams" yoki Telegram webview obyekti. Shunda SDK parser-bloklovchi yuklanadi
 * (window.Telegram.WebApp gidratsiyadan oldin tayyor). Yuklanmasa — qayta urinadi; "tg-sdk" hodisasi TelegramProvider'ga.
 */
const TELEGRAM_SDK_LOADER = `(function(){try{var u="https://telegram.org/js/telegram-web-app.js",tg=/tgWebApp/.test(location.hash+location.search)||!!window.TelegramWebviewProxy;try{tg=tg||/tgWebApp/.test(sessionStorage.getItem("__telegram__initParams")||"")}catch(e){}if(!tg)return;window.__tgSdkRetry=function(){var s=document.createElement("script");s.src=u;s.onload=function(){dispatchEvent(new Event("tg-sdk"))};document.head.appendChild(s)};document.write('<script src="'+u+'" onload="dispatchEvent(new Event(\\'tg-sdk\\'))" onerror="__tgSdkRetry()"><\\/script>')}catch(e){}})();`;

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
    title: { default: t("common.meta.title"), template: `%s · ${BRAND.name}` },
    description: t("common.meta.description"),
    keywords: t("common.meta.keywords"),
    applicationName: BRAND.name,
    manifest: "/manifest.webmanifest",
    icons: { icon: [{ url: "/icon.svg", type: "image/svg+xml" }, { url: "/icons/favicon-48.png", sizes: "48x48", type: "image/png" }], apple: "/icons/apple-touch-icon.png" },
    openGraph: { type: "website", siteName: BRAND.name, locale: locale === "ru" ? "ru_RU" : locale === "en" ? "en_US" : "uz_UZ", alternateLocale: ["uz_UZ", "ru_RU", "en_US"].filter((l) => l !== (locale === "ru" ? "ru_RU" : locale === "en" ? "en_US" : "uz_UZ")) },
    appleWebApp: { capable: true, statusBarStyle: "default", title: BRAND.name },
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
  // klaviatura ochilganda sahifa balandligi qisqaradi (Android Chrome): yopishqoq tugmalar klaviatura ustida qoladi (F2)
  interactiveWidget: "resizes-content",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const cookieStore = await cookies();
  const theme = cookieStore.get("ishuz_theme")?.value;
  return (
    // "oz" — ilova ichki kodi, BCP-47 da yo'q: ekran o'qigichi o'zbek kirill matnini taniy olishi uchun "uz-Cyrl"
    <html lang={locale === "oz" ? "uz-Cyrl" : locale} className={`${manrope.variable} ${theme === "dark" ? "dark" : ""}`} suppressHydrationWarning>
      <head>
        {/* Telegram Mini App SDK faqat Telegram ichida (gidratsiyadan oldin, avvalgidek). Oddiy brauzerda yuklanmaydi —
            tashqi skript kutilmagani uchun sahifa darhol "jonlanadi" (bosishlar kechikmaydi) */}
        <script dangerouslySetInnerHTML={{ __html: TELEGRAM_SDK_LOADER }} />
        {/* ochilish ekrani sessiyada bir marta: kerak bo'lmasa birinchi chizishdan oldin yashiriladi */}
        <script dangerouslySetInnerHTML={{ __html: SPLASH_BOOT }} />
        {/* Mavzu: cookie yo'q ("system") bo'lsa — qurilma sozlamasiga qarab, gidratsiyadan oldin (miltillashsiz) */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var m=document.cookie.match(/(?:^|; )ishuz_theme=(dark|light)/);var d=m?m[1]==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.classList.toggle('dark',d);}catch(e){}})();`,
          }}
        />
      </head>
      <body className="font-sans">
        <Splash />
        <Providers locale={locale} messages={clientMessages(locale)}>
          {children}
          <CelebrationListener />
        </Providers>
      </body>
    </html>
  );
}
