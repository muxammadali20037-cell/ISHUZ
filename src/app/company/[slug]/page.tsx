import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSession } from "@/features/auth/session";
import { getT } from "@/lib/i18n/server";
import { Shell } from "@/components/shared/shell";
import { getCompanyBySlug, getCompanyVacancies, getProfileRating } from "@/features/employer/queries";
import { CompanyPage } from "@/features/employer/components/company/company-page";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const [company, { t }] = await Promise.all([getCompanyBySlug(slug), getT()]);
  if (!company || company.is_blocked) return { title: t("common.errors.not_found"), robots: { index: false } };
  const title = t("employer.company.meta_title", { name: company.name });
  const description = company.about?.slice(0, 160) || t("employer.company.meta_description", { name: company.name });
  return {
    title,
    description,
    alternates: { canonical: `/company/${company.slug}` },
    openGraph: { title, description, type: "profile", url: `/company/${company.slug}`, images: company.logo_url ? [{ url: company.logo_url }] : undefined },
  };
}

/** /company/[slug] — ochiq kompaniya sahifasi (SEO). Yo'q yoki bloklangan bo'lsa 404. */
export default async function CompanyPublicPage({ params }: { params: Params }) {
  const { slug } = await params;
  const company = await getCompanyBySlug(slug);
  if (!company || company.is_blocked) notFound();
  const [vacancies, rating, session] = await Promise.all([getCompanyVacancies(company.id), company.created_by ? getProfileRating(company.created_by) : Promise.resolve(null), getSession()]);
  return (
    <Shell>
      <CompanyPage company={company} vacancies={vacancies} rating={rating} canManage={!!session && session.companyId === company.id} />
    </Shell>
  );
}
