"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Building2 } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";
import { Dialog, Sheet } from "@/components/ui/dialog";
import { PageHeader } from "@/components/ui/misc";
import { toast } from "@/components/ui/toast";
import { createCompanyForEmployer, updateEmployerProfile } from "../../actions";
import { errorMessageKey } from "../../mappers";
import type { CompanyFormValues, PersonFormValues } from "../../schema";
import type { EmployerProfileRow, VerificationRequestRow } from "../../types";
import { CompanyForm } from "../company-form";
import { PersonForm } from "../person-form";
import type { ReferenceLists } from "../ref-types";
import { VerificationTab } from "./verification-tab";

/** /company/settings (kompaniyasiz shaxs/YaTT): profil formasi + "Kompaniya yaratish" + shaxs tasdiqlash */
export function EmployerProfileSettings({ userId, profile, requests, refs }: { userId: string; profile: EmployerProfileRow; requests: VerificationRequestRow[]; refs: ReferenceLists }) {
  const { t } = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [creating, startCreating] = useTransition();
  const [open, setOpen] = useState(false);

  const saveProfile = (values: PersonFormValues) => {
    startTransition(async () => {
      const res = await updateEmployerProfile(values);
      if (!res.ok) {
        toast.error(t(errorMessageKey(res.error)));
        return;
      }
      toast.success(t("employer.settings.profile_saved"));
      router.refresh();
    });
  };

  const createCompany = (values: CompanyFormValues) => {
    startCreating(async () => {
      const res = await createCompanyForEmployer(values);
      if (!res.ok) {
        toast.error(t(errorMessageKey(res.error)));
        return;
      }
      toast.success(t("employer.settings.create_company_done"));
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <div className="container-narrow py-6">
      <PageHeader title={t("employer.settings.profile_title")} backHref="/employer" />
      <div className="space-y-6">
        <section className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:p-6">
          <PersonForm
            key={profile.updated_at}
            refs={refs}
            defaultValues={{
              displayName: profile.display_name ?? "",
              contactPhone: profile.contact_phone ?? "",
              regionId: profile.region_id ?? "",
              districtId: profile.district_id ?? "",
              about: profile.about ?? "",
            }}
            onSubmit={saveProfile}
            submitLabel={t("common.actions.save")}
            pending={pending}
          />
        </section>

        <section className="flex flex-col gap-4 rounded-2xl border border-primary/30 bg-primary-soft/40 p-4 sm:flex-row sm:items-center sm:p-6">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Building2 className="size-6" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold">{t("employer.settings.create_company")}</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">{t("employer.settings.create_company_desc")}</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <Button onClick={() => setOpen(true)} className="w-full sm:w-auto">
              {t("employer.settings.create_company")}
            </Button>
            <Sheet title={t("employer.settings.create_company")} description={t("employer.onboarding.step_company_subtitle")} className="sm:max-w-2xl">
              <CompanyForm refs={refs} defaultValues={{ regionId: profile.region_id ?? "", districtId: profile.district_id ?? "", phone: profile.contact_phone ?? "" }} onSubmit={createCompany} submitLabel={t("employer.settings.create_company")} pending={creating} className="pb-2" />
            </Sheet>
          </Dialog>
        </section>

        <VerificationTab userId={userId} companyId={null} status={profile.verification_status} requests={requests} canSubmit />
      </div>
    </div>
  );
}
