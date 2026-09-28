"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";
import { Dialog, Sheet } from "@/components/ui/dialog";
import { Input, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { toast } from "@/components/ui/toast";
import { scheduleInterview } from "../actions";
import { actionErrorText } from "../errors";
import { isoToTashkent, tashkentToIso, tashkentToday } from "../tashkent-time";

const TIMES = Array.from({ length: 27 }, (_, i) => {
  const m = 8 * 60 + i * 30; // 08:00 … 21:00, har 30 daqiqa
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
});

/** Suhbatga chaqirish / vaqtini o'zgartirish: sana + vaqt tugmalari + manzil (izoh ixtiyoriy) */
export function InterviewSheet({
  applicationId,
  vacancyId,
  initial,
  open,
  onOpenChange,
}: {
  applicationId: string;
  vacancyId: string;
  initial?: { at: string | null; place: string | null };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useT();
  const router = useRouter();
  const start = initial?.at ? isoToTashkent(initial.at) : null;
  const [date, setDate] = useState(start?.date ?? "");
  const [time, setTime] = useState(start?.time ?? "10:00");
  const [place, setPlace] = useState(initial?.place ?? "");
  const [note, setNote] = useState("");
  const [touched, setTouched] = useState(false);
  const [pending, startTransition] = useTransition();
  const reschedule = !!initial?.at;
  const at = tashkentToIso(date, time);

  const submit = () => {
    setTouched(true);
    if (!at) return;
    startTransition(async () => {
      const res = await scheduleInterview({ applicationId, vacancyId, at, place: place.trim() || undefined, note: note.trim() || undefined });
      if (!res.ok) {
        toast.error(actionErrorText(t, res.error));
        return;
      }
      toast.success(t("applications.interview.saved"));
      onOpenChange(false);
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <Sheet
        title={t(reschedule ? "applications.interview.reschedule_title" : "applications.interview.title")}
        description={t("applications.interview.desc")}
        footer={
          <Button fullWidth onClick={submit} loading={pending} disabled={touched && !at}>
            {t(reschedule ? "applications.interview.submit_reschedule" : "applications.interview.submit")}
          </Button>
        }
      >
        <div className="space-y-4">
          <Field label={t("applications.interview.date")} htmlFor="iv-date" required error={touched && !date ? t("applications.errors.invalid_interview_time") : undefined}>
            <Input id="iv-date" type="date" min={tashkentToday()} value={date} onChange={(e) => setDate(e.target.value)} invalid={touched && !date} />
          </Field>
          <Field label={t("applications.interview.time")} required>
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={t("applications.interview.time")}>
              {TIMES.map((v) => (
                <button
                  key={v}
                  type="button"
                  role="radio"
                  aria-checked={time === v}
                  onClick={() => setTime(v)}
                  className={`h-10 min-w-16 rounded-xl border px-2 text-sm font-medium tabular transition-colors ${time === v ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-secondary"}`}
                >
                  {v}
                </button>
              ))}
            </div>
          </Field>
          <Field label={t("applications.interview.place")} htmlFor="iv-place" hint={t("common.labels.optional")}>
            <Input id="iv-place" value={place} maxLength={300} onChange={(e) => setPlace(e.target.value)} placeholder={t("applications.interview.place_placeholder")} />
          </Field>
          <Field label={t("applications.interview.note")} htmlFor="iv-note" hint={t("common.labels.optional")}>
            <Textarea id="iv-note" value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)} placeholder={t("applications.interview.note_placeholder")} className="min-h-[80px]" />
          </Field>
        </div>
      </Sheet>
    </Dialog>
  );
}
