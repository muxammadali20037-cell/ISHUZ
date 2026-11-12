import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { getDistricts, getRegions } from "@/lib/reference";
import { requireSession } from "@/features/auth/session";
import { getPostViewer } from "@/features/post/queries";
import { MastersShell } from "@/features/masters/components/masters-shell";
import { ListingForm } from "@/features/masters/components/listing-form";
import { getMasterCategories } from "@/features/masters/queries";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return {
    title: `${t("masters.form.title_new")} · ${t("masters.name")}`,
    robots: { index: false },
  };
}

/** /ustalar/elon — yangi usta e'loni (kirish shart; ?k=<kategoriya> — oldindan tanlangan). Admin tasdig'idan keyin chiqadi. */
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
  const displayName = [session.profile.first_name, session.profile.last_name]
    .filter(Boolean)
    .join(" ");
  return (
    <MastersShell search={false} post={false}>
      <div className="container-narrow space-y-5 py-5 sm:py-8">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
            {t("masters.form.title_new")}
          </h1>
          <p className="mt-2 text-base text-muted-foreground">
            {t("masters.form.intro")}
          </p>
        </div>
        {categories.length ? (
          <ListingForm
          userId={session.userId}
          categories={categories}
          regions={regions}
          districts={districts}
          initial={null}
          defaults={{
            displayName,
            phone: viewer.phone,
            category: typeof sp.k === "string" ? sp.k : null,
          }}
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
