import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";
import { cookies } from "next/headers";
import { getLocale } from "@/lib/i18n/server";
import { Providers } from "./providers";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin", "cyrillic"],
  variable: "--font-manrope",
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  title: { default: "ISH.UZ — Ish qidirmang. O'zingizga mos ishni toping.", template: "%s · ISH.UZ" },
  description: "O'zbekistonda ish qidiruvchilar va ish beruvchilarni bir necha daqiqada aniq bog'laydigan platforma.",
  applicationName: "ISH.UZ",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
  openGraph: { type: "website", siteName: "ISH.UZ", locale: "uz_UZ", alternateLocale: ["ru_RU"] },
  appleWebApp: { capable: true, statusBarStyle: "default", title: "ISH.UZ" },
};

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
  const theme = (await cookies()).get("ishuz_theme")?.value;
  return (
    <html lang={locale} className={`${manrope.variable} ${theme === "dark" ? "dark" : ""}`} suppressHydrationWarning>
      <body className="font-sans">
        <Providers locale={locale}>{children}</Providers>
      </body>
    </html>
  );
}
