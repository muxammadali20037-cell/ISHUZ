import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getLocale } from "@/lib/i18n/server";
import { localeAlternates } from "@/lib/seo";
import { getSession } from "@/features/auth/session";
import { Shell } from "@/components/shared/shell";
import { HomePage as Home } from "@/features/landing/home-page";
import { getMode } from "@/features/mode/server";

export async function generateMetadata(): Promise<Metadata> {
  return { alternates: localeAlternates("/", await getLocale()) };
}

/**
 * Bosh sahifa: qidiruv va haqiqiy e'lonlar darhol (features/landing/home-page). Rejim tanlanmagan mehmon — ish qidiruvchi
 * ko'rinishi; ish beruvchi — o'z paneli. Hech qayerga majburan yo'naltirilmaydi.
 */
export default async function HomePage() {
  const [session, mode] = await Promise.all([getSession(), getMode()]);
  if (session?.profile.is_blocked) redirect("/blocked");
  return (
    <Shell>
      <Home session={session} mode={mode} />
    </Shell>
  );
}
