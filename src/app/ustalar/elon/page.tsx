import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { getDistricts, getRegions } from "@/lib/reference";
import { requireSession } from "@/features/auth/session";
import { getPostViewer } from "@/features/post/queries";
import { MastersShell } from "@/features/masters/components/masters-shell";
import { MasterWizard } from "@/features/masters/components/master-wizard";
import { getMasterCategories } from "@/features/masters/queries";
import { listingImageEnabled } from "@/features/listing-image/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return {
    title: `${t("masters.form.title_new")} · ${t("masters.name")}`,
    robots: { index: false },
  };
}

/**
 * /ustalar/elon — yangi usta e'loni, oynama-oyna (kirish shart; ?k=<kategoriya> — oldindan tanlangan, xizmatdan boshlanadi).
 * Joylash — darhol avtomatik tekshiruv bilan; toza bo'lsa katalogda shu zahoti (ega, 2026-11-17). Tahrirlash — /ustalar/elon/[id].
 */
export default async function MasterNewListingPage({
  searchParams,
}: {
  searchParams: Promise<{ k?: string }>;
}) {
  const session = await requireSession("/ustalar/elon");
  const [{ t }, categories, regions, districts, viewer, sp] = await Promise.all(
    [
      getT(),
      getMasterCategories(),
      getRegions(),
      getDistricts(),
      getPostViewer(session),
      searchParams,
    ],
  );
  return (
    <MastersShell search={false} post={false}>
      <div className="container-narrow py-5 sm:py-8">
        {categories.length ? (
          <MasterWizard
            userId={session.userId}
            categories={categories}
            regions={regions}
            districts={districts}
            defaults={{
              firstName: session.profile.first_name ?? "",
              lastName: session.profile.last_name ?? "",
              phone: viewer.phone,
              category: typeof sp.k === "string" ? sp.k : null,
            }}
            imageEnabled={listingImageEnabled()}
          />
        ) : (
          <p className="rounded-2xl border border-dashed border-border p-6 text-center text-muted-foreground" data-masters-unavailable>
            {t("masters.unavailable_desc")}
          </p>
        )}
      </div>
    </MastersShell>
  );
}
