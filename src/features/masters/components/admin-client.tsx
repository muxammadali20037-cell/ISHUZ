"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check, FlaskConical, Trash2, X } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { callAction } from "@/lib/action-call";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { masterDemo, moderateMasterListing } from "../actions";

/** Admin: e'lonni tasdiqlash yoki sabab bilan rad etish */
export function ModerateButtons({ id }: { id: string }) {
  const { t } = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState(false);

  const act = (action: "approve" | "reject") =>
    start(async () => {
      setError(false);
      const res = await callAction(() =>
        moderateMasterListing({
          id,
          action,
          reason: reason.trim() || undefined,
        }),
      );
      if (!res.ok) return setError(true);
      setDone(
        action === "approve"
          ? t("masters.admin.approved")
          : t("masters.admin.rejected"),
      );
      router.refresh();
    });

  if (done)
    return (
      <p className="text-sm font-semibold text-muted-foreground" role="status">
        {done}
      </p>
    );
  return (
    <div className="space-y-2" data-masters-moderate>
      {rejecting ? (
        <label className="grid gap-1 text-sm font-semibold">
          {t("masters.admin.reject_reason")}
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value.slice(0, 500))}
            rows={2}
            className="rounded-xl border border-input bg-background px-3 py-2 text-base font-normal"
          />
        </label>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          disabled={pending}
          onClick={() => act("approve")}
          className="h-11"
        >
          <Check className="size-4" aria-hidden /> {t("masters.admin.approve")}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={() => (rejecting ? act("reject") : setRejecting(true))}
          className="h-11 bg-card text-destructive"
        >
          <X className="size-4" aria-hidden /> {t("masters.admin.reject")}
        </Button>
      </div>
      {error ? (
        <p role="alert" className="text-sm font-semibold text-destructive">
          {t("masters.form.errors.generic")}
        </p>
      ) : null}
    </div>
  );
}

/** Demo e'lonlar: bir bosishda olib tashlash (tasdiq bilan) yoki qaytarish */
export function DemoControls({ count }: { count: number }) {
  const { t } = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const run = (action: "remove" | "seed") =>
    start(async () => {
      const res = await callAction(() => masterDemo({ action }));
      if (!res.ok || !res.data)
        return setNote(t("masters.form.errors.generic"));
      setNote(
        action === "remove"
          ? t("masters.admin.demo_removed", { count: res.data.count })
          : t("masters.admin.demo_seeded", { count: res.data.count }),
      );
      router.refresh();
    });

  return (
    <div
      className="flex flex-wrap items-center gap-2"
      data-masters-demo-controls
    >
      {count > 0 ? (
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={() => setConfirm(true)}
          className="h-11 bg-card text-destructive"
        >
          <Trash2 className="size-4" aria-hidden />{" "}
          {t("masters.admin.demo_remove")}
        </Button>
      ) : (
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={() => run("seed")}
          className="h-11 bg-card"
        >
          <FlaskConical className="size-4" aria-hidden />{" "}
          {t("masters.admin.demo_seed")}
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
        title={t("masters.admin.demo_remove")}
        description={t("masters.admin.demo_desc", { count })}
        confirmLabel={t("masters.admin.demo_remove")}
        cancelLabel={t("common.actions.cancel")}
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
