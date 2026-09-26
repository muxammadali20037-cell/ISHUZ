"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";
import { Dialog, Sheet } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/label";

export type SheetStatus = "interview" | "offered" | "rejected";
const KEY: Record<SheetStatus, "interview" | "offer" | "reject"> = { interview: "interview", offered: "offer", rejected: "reject" };

/**
 * Izohli holat o'zgartirish sheet'i:
 * interview — izoh majburiy (sana/vaqt/manzil), offered — ixtiyoriy, rejected — ixtiyoriy sabab.
 */
export function StatusSheet({
  status,
  open,
  onOpenChange,
  onSubmit,
  pending,
}: {
  status: SheetStatus;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (note: string) => Promise<boolean>;
  pending: boolean;
}) {
  const { t } = useT();
  const [note, setNote] = useState("");
  const [touched, setTouched] = useState(false);
  const k = KEY[status];
  const required = status === "interview";
  const invalid = required && note.trim().length < 3;

  const submit = async () => {
    setTouched(true);
    if (invalid) return;
    const ok = await onSubmit(note.trim());
    if (ok) {
      setNote("");
      setTouched(false);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <Sheet
        title={t(`applications.candidate.${k}_title`)}
        description={t(`applications.candidate.${k}_desc`)}
        footer={
          <Button fullWidth variant={status === "rejected" ? "destructive" : "default"} onClick={() => void submit()} loading={pending} disabled={required && invalid && touched}>
            {t(`applications.candidate.${status === "offered" ? "offer" : status === "rejected" ? "reject" : "interview"}`)}
          </Button>
        }
      >
        <Field
          label={t(`applications.candidate.${k}_note`)}
          htmlFor={`status-note-${status}`}
          required={required}
          hint={required ? undefined : t("common.labels.optional")}
          error={touched && invalid ? t("applications.errors.note_required") : undefined}
        >
          <Textarea
            id={`status-note-${status}`}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onBlur={() => setTouched(true)}
            maxLength={1000}
            placeholder={t(`applications.candidate.${k}_note_placeholder`)}
            invalid={touched && invalid}
            className="min-h-[110px]"
            autoFocus
          />
        </Field>
      </Sheet>
    </Dialog>
  );
}
