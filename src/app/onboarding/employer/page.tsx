import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireSession } from "@/features/auth/session";
import { getT } from "@/lib/i18n/server";
import { getCategories, getDistricts, getRegions } from "@/lib/reference";
import { Shell } from "@/components/shared/shell";
import { getEmployerProfile } from "@/features/employer/queries";
import { createClient } from "@/lib/supabase/server";
import { formatPhone } from "@/lib/format";
import { EmployerOnboarding } from "@/features/employer/components/onboarding/employer-onboarding";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("employer.onboarding.title"), robots: { index: false } };
}

/** /onboarding/employer — ish beruvchi profilini yaratish (2 qadam). Tugallangan bo'lsa → /employer */
export default async function EmployerOnboardingPage() {
  const session = await requireSession("/onboarding/employer");
  if (session.employerId && session.employerOnboarded) redirect("/employer");

  const supabase = await createClient();
  const [profile, regions, districts, categories, { data: contacts }] = await Promise.all([
    getEmployerProfile(session.userId),
    getRegions(),
    getDistricts(),
    getCategories(),
    supabase.from("profile_contacts").select("phone").eq("profile_id", session.userId).maybeSingle(),
  ]);
  // Telefon allaqachon tasdiqlangan bo'lsa (Telegram orqali ulashilgan) — qayta yozdirmaymiz
  const knownPhone = profile?.contact_phone ?? (contacts?.phone ? formatPhone(contacts.phone) : null);

  return (
    <Shell hideNav forceRole="employer">
      <EmployerOnboarding
        firstName={session.profile.first_name}
        prefill={{
          employerType: profile?.employer_type ?? null,
          displayName: profile?.display_name ?? null,
          contactPhone: knownPhone,
          regionId: profile?.region_id ?? null,
          districtId: profile?.district_id ?? null,
          about: profile?.about ?? null,
        }}
        refs={{
          regions: regions.map(({ id, name_uz, name_ru }) => ({ id, name_uz, name_ru })),
          districts: districts.map(({ id, region_id, name_uz, name_ru, lat, lng }) => ({ id, region_id, name_uz, name_ru, lat, lng })),
          categories: categories.map(({ id, name_uz, name_ru }) => ({ id, name_uz, name_ru })),
        }}
      />
    </Shell>
  );
}
