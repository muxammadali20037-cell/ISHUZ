"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { FlaskConical, Trash2 } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { callAction } from "@/lib/action-call";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { demoVacancies } from "../actions";

/** Admin: namuna vakansiyalarni bir bosishda olib tashlash (tasdiq bilan) yoki qaytarish */
export function DemoVacancyControls({ count }: { count: number }) {
  const { t } = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const run = (action: "remove" | "seed") =>
    start(async () => {
      const res = await callAction(() => demoVacancies({ action }));
      if (!res.ok || !res.data) return setNote(t("demo.admin.error"));
      setNote(action === "remove" ? t("demo.admin.removed", { count: res.data.count }) : t("demo.admin.seeded", { count: res.data.count }));
      router.refresh();
    });

  return (
    <div className="flex flex-wrap items-center gap-2" data-demo-controls>
      {count > 0 ? (
        <Button type="button" variant="outline" disabled={pending} onClick={() => setConfirm(true)} className="h-11 bg-card text-destructive" data-demo-remove>
          <Trash2 className="size-4" aria-hidden /> {t("demo.admin.remove")}
        </Button>
      ) : (
        <Button type="button" variant="outline" disabled={pending} onClick={() => run("seed")} className="h-11 bg-card" data-demo-seed>
          <FlaskConical className="size-4" aria-hidden /> {t("demo.admin.seed")}
        </Button>
      )}
      {note ? (
        <p role="status" className="text-sm font-semibold">
          {note}
        </p>
      ) : null}
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={t("demo.admin.remove")}
        description={t("demo.admin.confirm")}
        confirmLabel={t("demo.admin.confirm_yes")}
        cancelLabel={t("demo.admin.cancel")}
        destructive
        loading={pending}
        onConfirm={() => {
          setConfirm(false);
          run("remove");
        }}
      />
    </div>
  );
}
