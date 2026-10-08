import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { requireSession } from "@/features/auth/session";
import { Shell } from "@/components/shared/shell";
import { MatchesPage } from "@/features/cabinet/components/matches-page";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("easy.matches.title"), robots: { index: false } };
}

/** /cabinet/matches — hisoblangan moslik: ishchiga mos vakansiyalar, ish beruvchiga mos nomzodlar */
export default async function Page({ searchParams }: { searchParams: Promise<{ vacancy?: string }> }) {
  const session = await requireSession("/cabinet/matches");
  const { vacancy } = await searchParams;
  return (
    <Shell>
      <MatchesPage session={session} vacancyId={vacancy && /^[0-9a-f-]{36}$/i.test(vacancy) ? vacancy : null} />
    </Shell>
  );
}
