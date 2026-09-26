import type { Metadata } from "next";
import { requireSession } from "@/features/auth/session";
import { getT } from "@/lib/i18n/server";
import { Shell } from "@/components/shared/shell";
import { JoinCompany } from "@/features/employer/components/company/join-company";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("employer.join.title"), robots: { index: false } };
}

/** /company/join?token=... — taklif havolasi. Login talab qilinadi (next bilan qaytadi). */
export default async function JoinCompanyPage({ searchParams }: { searchParams: Promise<{ token?: string | string[] }> }) {
  const sp = await searchParams;
  const raw = Array.isArray(sp.token) ? sp.token[0] : sp.token;
  const token = raw && raw.trim().length >= 8 ? raw.trim() : null;
  await requireSession(token ? `/company/join?token=${encodeURIComponent(token)}` : "/company/join");
  return (
    <Shell hideNav>
      <div className="container-narrow py-8 sm:py-14">
        <JoinCompany token={token} />
      </div>
    </Shell>
  );
}
