import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { safeInternalPath } from "@/lib/security/safe-path";
import { WelcomeScreen } from "@/features/entry/components/welcome-screen";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("welcome.entry.welcome.title"), robots: { index: false } };
}

/** Birinchi ochilish (2.0): xush kelibsiz ekrani — til va rol bitta joyda; ?lang= (JS'siz til) proxy'da o'qiladi */
export default async function WelcomePage({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
  const sp = await searchParams;
  return <WelcomeScreen error={!!sp.error} next={safeInternalPath(sp.next, "") || null} />;
}
