"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";
import { Stepper } from "@/components/ui/misc";
import { toast } from "@/components/ui/toast";
import { completeCompanyOnboarding, completePersonOnboarding, saveEmployerDraft, saveEmployerType } from "../../actions";
import { errorMessageKey } from "../../mappers";
import type { CompanyFormValues, PersonFormInput, PersonFormValues } from "../../schema";
import { CompanyForm } from "../company-form";
import { PersonForm } from "../person-form";
import type { ReferenceLists } from "../ref-types";
import { EmployerTypeStep, type EmployerType } from "./employer-type-step";

export interface OnboardingPrefill {
  employerType: EmployerType | null;
  displayName: string | null;
  contactPhone: string | null;
  regionId: string | null;
  districtId: string | null;
  about: string | null;
}

/**
 * Ish beruvchi onboarding: 1) tur  2) joylashuv → viloyat → tuman → nom → telefon (logo va boshqalar — keyin sozlamalarda).
 * 1-qadam tanlovi darhol saqlanadi; qaytganda 2-qadamdan davom etadi.
 */
export function EmployerOnboarding({ prefill, refs, firstName }: { prefill: OnboardingPrefill; refs: ReferenceLists; firstName: string }) {
  const { t } = useT();
  const router = useRouter();
  const [type, setType] = useState<EmployerType | null>(prefill.employerType);
  const [note, setNote] = useState("");
  const [step, setStep] = useState<1 | 2>(prefill.employerType ? 2 : 1);
  const [pending, startTransition] = useTransition();

  const fail = (code: string): void => {
    toast.error(t(errorMessageKey(code)));
  };

  const continueFromType = () => {
    if (!type) return;
    startTransition(async () => {
      const res = await saveEmployerType({ employerType: type, note });
      if (!res.ok) {
        fail(res.error);
        return;
      }
      setStep(2);
      window.scrollTo({ top: 0 });
    });
  };

  const goBack = (draft?: PersonFormInput) => {
    startTransition(async () => {
      if (draft) await saveEmployerDraft(draft); // best-effort qoralama
      setStep(1);
      window.scrollTo({ top: 0 });
    });
  };

  const finish = () => {
    toast.success(t("employer.onboarding.done_toast"));
    router.replace("/employer");
    router.refresh();
  };

  const submitCompany = (values: CompanyFormValues) => {
    if (type !== "company" && type !== "government" && type !== "individual_entrepreneur" && type !== "other") return;
    startTransition(async () => {
      const res = await completeCompanyOnboarding({ ...values, employerType: type });
      if (!res.ok) {
        fail(res.error);
        return;
      }
      if (!res.data) {
        fail("generic");
        return;
      }
      finish();
    });
  };

  const submitPerson = (values: PersonFormValues) => {
    startTransition(async () => {
      const res = await completePersonOnboarding({ ...values, employerType: type === "self_employed" ? "self_employed" : "person" });
      if (!res.ok) {
        fail(res.error);
        return;
      }
      finish();
    });
  };

  const backButton = (onClick: () => void) => (
    <Button type="button" variant="ghost" size="lg" onClick={onClick} disabled={pending}>
      <ChevronLeft className="size-5" /> {t("common.actions.back")}
    </Button>
  );

  const isCompanyType = type === "company" || type === "government" || type === "individual_entrepreneur" || type === "other";
  const personDefaults: Partial<PersonFormInput> = {
    displayName: prefill.displayName ?? "",
    contactPhone: prefill.contactPhone ?? "",
    regionId: prefill.regionId ?? "",
    districtId: prefill.districtId ?? "",
    about: prefill.about ?? "",
  };

  return (
    <div className="container-narrow py-6 sm:py-10">
      <Stepper current={step} total={2} label={t("employer.onboarding.title")} className="mb-6" />

      {step === 1 ? (
        <section>
          <h1 className="text-2xl font-bold sm:text-3xl">{t("employer.onboarding.step_type_title")}</h1>
          <p className="mt-2 text-sm text-muted-foreground sm:text-base">{t("employer.onboarding.step_type_subtitle")}</p>
          <div className="mt-6">
            <EmployerTypeStep value={type} onChange={setType} disabled={pending} note={note} onNoteChange={setNote} />
          </div>
          <div className="mt-8 flex justify-end">
            <Button size="lg" onClick={continueFromType} disabled={!type} loading={pending} className="w-full sm:w-auto sm:min-w-48">
              {t("common.actions.continue")}
            </Button>
          </div>
        </section>
      ) : isCompanyType ? (
        <section>
          <h1 className="sr-only">{t("employer.onboarding.step_company_title")}</h1>
          <div>
            <CompanyForm
              stepByStep
              refs={refs}
              defaultValues={{ regionId: prefill.regionId ?? "", districtId: prefill.districtId ?? "", about: prefill.about ?? "", phone: prefill.contactPhone ?? "" }}
              onSubmit={submitCompany}
              submitLabel={t("employer.onboarding.finish")}
              pending={pending}
              secondaryAction={backButton(() => goBack())}
            />
          </div>
        </section>
      ) : (
        <section>
          <h1 className="sr-only">{t("employer.onboarding.step_person_title")}</h1>
          <div>
            <PersonForm
              stepByStep
              refs={refs}
              defaultValues={{ ...personDefaults, displayName: personDefaults.displayName || firstName }}
              onSubmit={submitPerson}
              submitLabel={t("employer.onboarding.finish")}
              pending={pending}
              onBack={(draft) => goBack(draft)}
              backLabel={t("common.actions.back")}
            />
          </div>
        </section>
      )}
    </div>
  );
}
