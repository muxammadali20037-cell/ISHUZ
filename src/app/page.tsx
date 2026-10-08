import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getLocale } from "@/lib/i18n/server";
import { localeAlternates } from "@/lib/seo";
import { getSession } from "@/features/auth/session";
import { Shell } from "@/components/shared/shell";
import { HomeThree } from "@/features/landing/home-three";

export async function generateMetadata(): Promise<Metadata> {
  return { alternates: localeAlternates("/", await getLocale()) };
}

/**
 * Bosh sahifa hamma uchun bir xil: uchta katta karta (ish qidiryapman / ishchi qidiryapman / qidirish)
 * va ixcham "Kabinetim". Kirgan foydalanuvchi ham shu sahifani ko'radi — hech qayerga majburan yo'naltirilmaydi.
 */
export default async function HomePage() {
  const session = await getSession();
  if (session?.profile.is_blocked) redirect("/blocked");
  return (
    <Shell>
      <HomeThree session={session} />
    </Shell>
  );
}
