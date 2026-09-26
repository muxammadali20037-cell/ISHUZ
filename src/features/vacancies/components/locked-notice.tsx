"use client";

import Link from "next/link";
import { ShieldAlert, Lock, Copy, Settings2 } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";
import type { VacancyFull } from "../types";
import { useVacancyActions } from "./use-vacancy-actions";

/** Tahrirlab bo'lmaydigan holat: admin yashirgan (hidden) yoki foydalanuvchi faqat ko'ra oladi (viewer) */
export function LockedNotice({ vacancy, reason }: { vacancy: VacancyFull; reason: "hidden" | "viewer" }) {
  const { t } = useT();
  const actions = useVacancyActions();
  const Icon = reason === "hidden" ? ShieldAlert : Lock;
  return (
    <div className="container-narrow py-10">
      <div className="flex flex-col items-center rounded-2xl border border-border bg-card px-6 py-10 text-center shadow-sm">
        <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-destructive-soft text-destructive">
          <Icon className="size-7" />
        </div>
        <h1 className="text-lg font-bold">{t(reason === "hidden" ? "vacancies.wizard.locked_title" : "vacancies.wizard.view_only_title")}</h1>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">{t(reason === "hidden" ? "vacancies.wizard.locked_desc" : "vacancies.wizard.view_only_desc")}</p>
        {reason === "hidden" && vacancy.moderation_note ? (
          <p className="mt-3 w-full rounded-xl bg-secondary px-3 py-2 text-left text-sm">
            <span className="font-semibold">{t("vacancies.manage.moderation_note")}:</span> {vacancy.moderation_note}
          </p>
        ) : null}
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button asChild variant="outline">
            <Link href={`/employer/vacancies/${vacancy.id}`}>
              <Settings2 className="size-4" /> {t("vacancies.actions.go_manage")}
            </Link>
          </Button>
          {reason === "hidden" ? (
            <Button onClick={() => actions.duplicate(vacancy.id)} loading={actions.pending}>
              <Copy className="size-4" /> {t("vacancies.actions.duplicate")}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
