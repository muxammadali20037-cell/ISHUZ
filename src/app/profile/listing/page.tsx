import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { requireWorker } from "@/features/auth/session";
import { Shell } from "@/components/shared/shell";
import { Progress } from "@/components/ui/progress";
import { ListingVisibility } from "@/features/profile/components/listing-visibility";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("profile.listing.title"), robots: { index: false } };
}

/** /profile/listing — "Ish qidirish e'loni": nima bilishim, ko'rinish va bo'limlar (bir ekranda bitta vazifa — har bo'lim alohida tahrirlanadi) */
export default async function ListingPage() {
  const session = await requireWorker("/profile/listing");
  const supabase = await createClient();
  const [{ t }, { data: w }] = await Promise.all([
    getT(),
    supabase.from("worker_profiles").select("is_public, status, completeness, listed_until").eq("id", session.workerId).maybeSingle(),
  ]);
  const steps = [
    { href: "/profile/profession", label: t("profile.listing.step_profession") },
    { href: "/profile/edit#skills", label: t("profile.listing.step_skills") },
    { href: "/profile/edit#experience", label: t("profile.listing.step_experience") },
    { href: "/profile/edit#location", label: t("profile.listing.step_location") },
    { href: "/profile/edit#preferences", label: t("profile.listing.step_preferences") },
    { href: "/profile/edit#education", label: t("profile.listing.step_education") },
    { href: "/profile/portfolio", label: t("profile.listing.step_portfolio") },
    { href: "/profile/edit#about", label: t("profile.listing.step_about") },
  ];
  return (
    <Shell>
      <div className="container-narrow space-y-7 py-5 sm:py-8">
        <div>
          <Link href="/" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ChevronLeft className="size-4" /> {t("common.nav.home")}
          </Link>
          <h1 className="text-2xl font-extrabold">{t("profile.listing.title")}</h1>
          <p className="mt-1 text-muted-foreground">{t("profile.listing.subtitle")}</p>
          <div className="mt-4">
            <div className="mb-1 flex justify-between text-sm">
              <span>{t("profile.listing.ready")}</span>
              <span className="font-semibold tabular">{w?.completeness ?? 0}%</span>
            </div>
            <Progress value={w?.completeness ?? 0} />
          </div>
        </div>

        <section>
          <h2 className="mb-3 text-lg font-bold">{t("profile.listing.parts")}</h2>
          <ol className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
            {steps.map((s, i) => (
              <li key={s.href}>
                <Link href={s.href} className="flex items-center gap-3 p-4 hover:bg-secondary/60">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-bold text-primary">{i + 1}</span>
                  <span className="flex-1 font-medium">{s.label}</span>
                  <ChevronRight className="size-5 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ol>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-bold">{t("profile.listing.visibility")}</h2>
          <ListingVisibility workerId={session.workerId} isPublic={!!w?.is_public} status={w?.status ?? "active"} listedUntil={w?.listed_until ?? null} />
        </section>
      </div>
    </Shell>
  );
}
