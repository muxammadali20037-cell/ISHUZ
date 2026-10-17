import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getLocale } from "@/lib/i18n/server";
import { localeAlternates } from "@/lib/seo";
import { getSession } from "@/features/auth/session";
import { Shell } from "@/components/shared/shell";
import { HomePage as Home } from "@/features/landing/home-page";
import { getMode } from "@/features/mode/server";
import { entryPath, homeEntryStep } from "@/features/entry/flow";
import { getEntryState } from "@/features/entry/server";

export async function generateMetadata(): Promise<Metadata> {
  return { alternates: localeAlternates("/", await getLocale()) };
}

/**
 * Bosh sahifa: qidiruv va haqiqiy e'lonlar darhol (features/landing/home-page). Rejim tanlanmagan mehmon — ish qidiruvchi
 * ko'rinishi; ish beruvchi — o'z paneli.
 * Birinchi ochilishda (robot emas) — avval til va tanishtiruv; oqimni boshlab, profilini tugatmagan — to'xtagan qadamiga
 * (features/entry/flow). Qaytgan foydalanuvchi va to'g'ridan-to'g'ri havolalar (vakansiya, qidiruv) — hech qachon.
 */
export default async function HomePage() {
  const [session, mode, entry] = await Promise.all([getSession(), getMode(), getEntryState()]);
  if (session?.profile.is_blocked) redirect("/blocked");
  const step = homeEntryStep(entry);
  if (step) redirect(entryPath(step, { mode }));
  return (
    <Shell>
      <Home session={session} mode={mode} />
    </Shell>
  );
}
