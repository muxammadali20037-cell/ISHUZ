"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n/client";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { toast } from "@/components/ui/toast";
import type { ActionResult } from "@/features/auth/actions";

/**
 * Tasdiqlash dialogi (ixtiyoriy izoh bilan) → server action.
 * Muvaffaqiyat: toast + router.refresh(). Xato: toast (admin.errors.<code> yoki common.errors.<code>).
 */
export function NoteActionButton({
  label,
  title,
  description,
  confirmLabel,
  noteLabel,
  noteRequired,
  destructive,
  variant = "outline",
  size = "sm",
  icon,
  disabled,
  successMessage,
  action,
  onDone,
  className,
  extra,
}: {
  label: ReactNode;
  title: string;
  description?: string;
  confirmLabel?: string;
  /** Izoh maydoni yorlig'i; berilmasa izoh so'ralmaydi */
  noteLabel?: string;
  noteRequired?: boolean;
  destructive?: boolean;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  icon?: ReactNode;
  disabled?: boolean;
  successMessage?: string;
  action: (note: string) => Promise<ActionResult<unknown>>;
  onDone?: () => void;
  className?: string;
  /** Izohdan oldingi qo'shimcha maydonlar (masalan, sabab turi) */
  extra?: ReactNode;
}) {
  const { t } = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();

  const run = () => {
    if (noteRequired && !note.trim()) {
      toast.error(t("common.errors.required"));
      return;
    }
    startTransition(async () => {
      const res = await action(note.trim());
      if (!res.ok) {
        toast.error(errorText(t, res.error));
        return;
      }
      toast.success(successMessage ?? t("admin.common.done"));
      setOpen(false);
      setNote("");
      onDone?.();
      router.refresh();
    });
  };

  return (
    <>
      <Button type="button" variant={variant} size={size} disabled={disabled} onClick={() => setOpen(true)} className={className}>
        {icon}
        {label}
      </Button>
      <Dialog open={open} onOpenChange={(o) => !pending && setOpen(o)}>
        <DialogContent title={title} description={description}>
          {extra}
          {noteLabel ? (
            <Field label={noteLabel} htmlFor="note-dialog-note" required={noteRequired}>
              <Textarea id="note-dialog-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} className="min-h-[90px]" autoFocus />
            </Field>
          ) : null}
          <div className="mt-4 flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)} disabled={pending}>
              {t("common.actions.cancel")}
            </Button>
            <Button type="button" variant={destructive ? "destructive" : "default"} onClick={run} loading={pending}>
              {confirmLabel ?? t("common.actions.confirm")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Xato kodini matnga aylantirish: avval admin.errors, keyin common.errors */
export function errorText(t: (key: string) => string, code: string): string {
  const adminKey = `admin.errors.${code}`;
  const a = t(adminKey);
  if (a !== adminKey) return a;
  const commonKey = `common.errors.${code}`;
  const c = t(commonKey);
  return c !== commonKey ? c : t("common.errors.generic");
}
