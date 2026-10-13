import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getLocale } from "@/lib/i18n/server";
import { localeAlternates } from "@/lib/seo";
import { getSession } from "@/features/auth/session";
import { Shell } from "@/components/shared/shell";
import { HomeThree } from "@/features/landing/home-three";
import { getMode } from "@/features/mode/server";

export async function generateMetadata(): Promise<Metadata> {
  return { alternates: localeAlternates("/", await getLocale()) };
}

/**
 * Bosh sahifa joriy rejimda: tanlanmagan bo'lsa — "Siz nima qidiryapsiz?", aks holda faqat shu rejimning bo'limlari
 * (features/landing/home-three). Hech qayerga majburan yo'naltirilmaydi.
 */
export default async function HomePage() {
  const [session, mode] = await Promise.all([getSession(), getMode()]);
  if (session?.profile.is_blocked) redirect("/blocked");
  return (
    <Shell>
      <HomeThree session={session} mode={mode} />
    </Shell>
  );
}
