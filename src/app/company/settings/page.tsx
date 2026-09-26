import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireEmployer } from "@/features/auth/session";
import { getT } from "@/lib/i18n/server";
import { getCategories, getDistricts, getRegions } from "@/lib/reference";
import { Shell } from "@/components/shared/shell";
import { getCompanyById, getCompanyMembers, getEmployerProfile, getMyCompanyRole, getPendingInvites, getVerificationRequests } from "@/features/employer/queries";
import { CompanySettings } from "@/features/employer/components/settings/company-settings";
import { EmployerProfileSettings } from "@/features/employer/components/settings/employer-profile-settings";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("employer.settings.title"), robots: { index: false } };
}

/** /company/settings — kompaniya sozlamalari (bo'lsa) yoki ish beruvchi profili (shaxs/YaTT) */
export default async function CompanySettingsPage() {
  const session = await requireEmployer("/company/settings");
  const { userId, companyId } = session;
  const [profile, regions, districts, categories] = await Promise.all([getEmployerProfile(userId), getRegions(), getDistricts(), getCategories()]);
  if (!profile) redirect("/onboarding/employer");
  const refs = {
    regions: regions.map(({ id, name_uz, name_ru }) => ({ id, name_uz, name_ru })),
    districts: districts.map(({ id, region_id, name_uz, name_ru }) => ({ id, region_id, name_uz, name_ru })),
    categories: categories.map(({ id, name_uz, name_ru }) => ({ id, name_uz, name_ru })),
  };

  if (companyId) {
    const [company, myRole, members, requests] = await Promise.all([getCompanyById(companyId), getMyCompanyRole(companyId, userId), getCompanyMembers(companyId), getVerificationRequests(userId, companyId)]);
    if (company) {
      const invites = myRole === "owner" || myRole === "admin" ? await getPendingInvites(companyId) : [];
      return (
        <Shell forceRole="employer">
          <CompanySettings userId={userId} company={company} myRole={myRole} members={members} invites={invites} requests={requests} refs={refs} />
        </Shell>
      );
    }
  }

  const requests = await getVerificationRequests(userId, null);
  return (
    <Shell forceRole="employer">
      <EmployerProfileSettings userId={userId} profile={profile} requests={requests} refs={refs} />
    </Shell>
  );
}
