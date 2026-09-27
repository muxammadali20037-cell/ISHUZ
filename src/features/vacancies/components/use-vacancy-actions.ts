"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n/client";
import { toast } from "@/components/ui/toast";
import { deleteVacancy, duplicateVacancy, publishVacancy, setVacancyStatus } from "../actions";
import type { VacancyStatus } from "../types";
import { errorMessage } from "../utils";
import { requestPayment } from "@/features/billing/components/payment-dialog";

/**
 * Ro'yxat va boshqaruv sahifasi uchun umumiy amallar: e'lon qilish, to'xtatish, yopish, nusxa, o'chirish.
 * Har amal toast beradi va sahifani yangilaydi.
 */
export function useVacancyActions() {
  const { t } = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  const run = (id: string, fn: () => Promise<void>) => {
    setBusyId(id);
    startTransition(async () => {
      try {
        await fn();
      } finally {
        setBusyId(null);
      }
    });
  };

  const publish = (id: string, onDone?: (status: VacancyStatus) => void) =>
    run(id, async () => {
      const res = await publishVacancy({ vacancyId: id });
      if (!res.ok) {
        if (res.error === "payment_required") {
          requestPayment({ purpose: "vacancy_publish", targetId: id });
          return;
        }
        toast.error(errorMessage(t, res.error));
        return;
      }
      const status = res.data?.status ?? "active";
      if (status === "pending_review") toast.success(t("vacancies.toast.pending_review"), t("vacancies.toast.pending_review_desc"));
      else toast.success(t("vacancies.toast.published"), t("vacancies.toast.published_desc"));
      router.refresh();
      onDone?.(status);
    });

  const pause = (id: string, onDone?: () => void) =>
    run(id, async () => {
      const res = await setVacancyStatus({ vacancyId: id, status: "paused" });
      if (!res.ok) {
        toast.error(errorMessage(t, res.error));
        return;
      }
      toast.success(t("vacancies.toast.paused"));
      router.refresh();
      onDone?.();
    });

  const close = (id: string, onDone?: () => void) =>
    run(id, async () => {
      const res = await setVacancyStatus({ vacancyId: id, status: "closed" });
      if (!res.ok) {
        toast.error(errorMessage(t, res.error));
        return;
      }
      toast.success(t("vacancies.toast.closed"));
      router.refresh();
      onDone?.();
    });

  const duplicate = (id: string) =>
    run(id, async () => {
      const res = await duplicateVacancy({ vacancyId: id });
      if (!res.ok || !res.data) {
        toast.error(errorMessage(t, res.ok ? "generic" : res.error));
        return;
      }
      toast.success(t("vacancies.toast.duplicated"), t("vacancies.toast.duplicated_desc"));
      router.push(`/employer/vacancies/${res.data.id}/edit`);
    });

  const remove = (id: string, onDone?: () => void) =>
    run(id, async () => {
      const res = await deleteVacancy({ vacancyId: id });
      if (!res.ok) {
        toast.error(errorMessage(t, res.error));
        return;
      }
      toast.success(t("vacancies.toast.deleted"));
      router.refresh();
      onDone?.();
    });

  return { pending, busyId, publish, pause, close, duplicate, remove };
}
