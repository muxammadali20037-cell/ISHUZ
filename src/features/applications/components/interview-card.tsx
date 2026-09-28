"use client";

import { useState } from "react";
import { CalendarClock, MapPin } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { InterviewSheet } from "./interview-sheet";

/** Suhbat vaqti va joyi. Ish beruvchi uchun "Vaqtni o'zgartirish" tugmasi bilan. */
export function InterviewCard({
  at,
  place,
  manage,
}: {
  at: string;
  place: string | null;
  manage?: { applicationId: string; vacancyId: string };
}) {
  const { t, locale } = useT();
  const [open, setOpen] = useState(false);
  return (
    <section className="rounded-2xl border border-primary/30 bg-primary-soft/40 p-4">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <CalendarClock className="size-4 text-primary" /> {t("applications.interview.card_title")}
      </p>
      <p className="mt-2 text-lg font-bold">{formatDate(at, locale, "EEEE, d MMMM · HH:mm")}</p>
      {place ? (
        <p className="mt-1 flex items-start gap-1.5 text-sm text-foreground/90">
          <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" /> {place}
        </p>
      ) : null}
      {manage ? (
        <>
          <Button type="button" size="sm" variant="outline" className="mt-3" onClick={() => setOpen(true)}>
            {t("applications.interview.reschedule")}
          </Button>
          {open ? <InterviewSheet applicationId={manage.applicationId} vacancyId={manage.vacancyId} initial={{ at, place }} open onOpenChange={setOpen} /> : null}
        </>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">{t("applications.interview.worker_hint")}</p>
      )}
    </section>
  );
}
