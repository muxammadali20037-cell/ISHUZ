import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getT } from "@/lib/i18n/server";
import { getSession } from "@/features/auth/session";
import { getMode } from "@/features/mode/server";
import { Shell } from "@/components/shared/shell";
import { MatchesInvite, MatchesPage } from "@/features/cabinet/components/matches-page";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("easy.matches.title"), robots: { index: false } };
}

/** /cabinet/matches — "Sizga mos": ishchiga mos vakansiyalar, ish beruvchiga mos nomzodlar (rejimga qarab) */
export default async function Page({ searchParams }: { searchParams: Promise<{ vacancy?: string }> }) {
  const [session, mode, { vacancy }] = await Promise.all([getSession(), getMode(), searchParams]);
  if (session?.profile.is_blocked) redirect("/blocked");
  // mehmon ("Sizga mos" pastki menyuda): kirishga majburlanmaydi — nima bo'lishini tushuntirib, e'lon berishga taklif
  if (!session) {
    const { t } = await getT();
    return (
      <Shell>
        <div className="container-narrow space-y-6 py-6 text-lg sm:py-8">
          <h1 className="text-page font-extrabold sm:text-page-lg">{t(mode === "employer" ? "easy.matches.candidates_title" : "easy.matches.jobs_title")}</h1>
          <MatchesInvite mode={mode === "employer" ? "employer" : "worker"} />
        </div>
      </Shell>
    );
  }
  return (
    <Shell>
      <MatchesPage session={session} mode={mode} vacancyId={vacancy && /^[0-9a-f-]{36}$/i.test(vacancy) ? vacancy : null} />
    </Shell>
  );
}
