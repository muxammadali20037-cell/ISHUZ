"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { initials } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toast";
import { updateCompany } from "../../actions";
import { errorMessageKey } from "../../mappers";
import type { CompanyFormInput, CompanyFormValues } from "../../schema";
import type { CompanyMemberRole, CompanyRow } from "../../types";
import { CompanyForm } from "../company-form";
import { LogoUploader } from "../logo-picker";
import type { ReferenceLists } from "../ref-types";

export function companyToForm(c: CompanyRow): CompanyFormInput {
  return {
    name: c.name,
    phone: c.phone ?? "",
    telegram: c.telegram ?? "",
    website: c.website ?? "",
    instagram: c.instagram ?? "",
    address: c.address ?? "",
    regionId: c.region_id ?? "",
    districtId: c.district_id ?? "",
    industryCategoryId: c.industry_category_id ?? "",
    about: c.about ?? "",
    size: c.size ?? "",
    tin: c.tin ?? "",
  };
}

/** Ma'lumotlar: logotip + kompaniya formasi (faqat owner/admin tahrirlaydi) */
export function CompanyInfoTab({ company, myRole, refs }: { company: CompanyRow; myRole: CompanyMemberRole | null; refs: ReferenceLists }) {
  const { t, tEnum } = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const canEdit = myRole === "owner" || myRole === "admin";

  const save = (values: CompanyFormValues) => {
    startTransition(async () => {
      const res = await updateCompany({ ...values, companyId: company.id });
      if (!res.ok) {
        toast.error(t(errorMessageKey(res.error)));
        return;
      }
      toast.success(t("employer.settings.saved"));
      router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">{t("employer.settings.your_role")}:</span>
        {myRole ? <Badge variant="primary">{tEnum("company_member_role", myRole)}</Badge> : null}
        <Link href={`/company/${company.slug}`} className="ml-auto inline-flex items-center gap-1 font-medium text-primary hover:underline">
          {t("employer.settings.public_page")} <ExternalLink className="size-3.5" />
        </Link>
      </div>
      {!canEdit ? <p className="rounded-xl bg-secondary p-3 text-sm text-muted-foreground">{t("employer.settings.readonly_notice")}</p> : null}
      <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:p-6">
        <CompanyForm
          key={company.updated_at}
          refs={refs}
          defaultValues={companyToForm(company)}
          onSubmit={save}
          submitLabel={t("common.actions.save")}
          pending={pending}
          readOnly={!canEdit}
          topSlot={
            <div>
              <p className="mb-2 text-sm font-medium">{t("employer.form.logo")}</p>
              <LogoUploader companyId={company.id} logoUrl={company.logo_url} fallback={initials(company.name)} disabled={!canEdit} />
            </div>
          }
        />
      </div>
    </div>
  );
}
