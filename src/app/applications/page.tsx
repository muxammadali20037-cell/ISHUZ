import type { Metadata } from "next";
import { FileText } from "lucide-react";
import { requireSession } from "@/features/auth/session";
import { EmptyState } from "@/components/ui/misc";
import { getT } from "@/lib/i18n/server";
import { Shell } from "@/components/shared/shell";
import { ApplicationsList } from "@/features/applications/components/applications-list";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("applications.meta.title") };
}

/** /applications?tab=active|archive — ishchining arizalari */
export default async function ApplicationsPage({ searchParams }: { searchParams: Promise<{ tab?: string | string[] }> }) {
  const session = await requireSession("/applications");
  // hali ish qidiruvchi profili yo'q (ish beruvchi yoki yangi foydalanuvchi): onboardingga majburan emas — nima qilish kerakligi
  if (!session.workerId) {
    const { t } = await getT();
    return (
      <Shell forceRole="worker">
        <div className="container-narrow py-6 sm:py-10">
          <h1 className="mb-4 text-2xl font-bold sm:text-3xl">{t("applications.meta.title")}</h1>
          <EmptyState
            icon={FileText}
            title={t("applications.list.empty_title")}
            description={t("applications.list.empty_desc")}
            action={{ label: t("applications.list.empty_cta"), href: "/" }}
          />
        </div>
      </Shell>
    );
  }
  const sp = await searchParams;
  const raw = Array.isArray(sp.tab) ? sp.tab[0] : sp.tab;
  const tab = raw === "archive" ? "archive" : "active";
  return (
    <Shell forceRole="worker">
      <ApplicationsList workerId={session.workerId} tab={tab} />
    </Shell>
  );
}
