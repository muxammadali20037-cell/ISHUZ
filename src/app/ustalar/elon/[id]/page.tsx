import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getT } from "@/lib/i18n/server";
import { getDistricts, getRegions } from "@/lib/reference";
import { requireSession } from "@/features/auth/session";
import { MastersShell } from "@/features/masters/components/masters-shell";
import { ListingForm } from "@/features/masters/components/listing-form";
import {
  getMasterCategories,
  getMyMasterListing,
} from "@/features/masters/queries";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return {
    title: `${t("masters.form.title_edit")} · ${t("masters.name")}`,
    robots: { index: false },
  };
}

/** /ustalar/elon/[id] — o'z e'lonini tahrirlash (RLS: faqat egasi o'qiydi). Faol e'lon mazmuni o'zgarsa — qayta moderatsiya. */
export default async function MasterEditListingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireSession(`/ustalar/elon/${id}`);
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const [{ t }, listing, categories, regions, districts] = await Promise.all([
    getT(),
    getMyMasterListing(id),
    getMasterCategories(),
    getRegions(),
    getDistricts(),
  ]);
  if (!listing || listing.owner_profile_id !== session.userId) notFound();
  return (
    <MastersShell search={false} post={false}>
      <div className="container-narrow space-y-5 py-5 sm:py-8">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
            {t("masters.form.title_edit")}
          </h1>
          <p className="mt-2 text-base text-muted-foreground">
            {t("masters.form.intro")}
          </p>
          {listing.status === "rejected" && listing.reject_reason ? (
            <p
              className="mt-3 rounded-xl bg-destructive-soft px-4 py-3 text-base text-destructive"
              role="alert"
            >
              {t("masters.cab.reject_reason", {
                reason: listing.reject_reason,
              })}{" "}
              {t("masters.cab.reject_hint")}
            </p>
          ) : null}
        </div>
        <ListingForm
          userId={session.userId}
          categories={categories}
          regions={regions}
          districts={districts}
          initial={listing}
          defaults={{
            displayName: listing.display_name,
            phone: listing.phone,
            category: null,
          }}
        />
      </div>
    </MastersShell>
  );
}
