"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Eye, EyeOff, Send, Trash2 } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { callAction } from "@/lib/action-call";
import { ConfirmDialog } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  deleteMasterListing,
  setMasterListingStatus,
  setMasterRequestStatus,
} from "../actions";
import type { MasterListingStatus, MasterRequestStatus } from "../types";

const btn =
  "press inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-border bg-card px-3 text-sm font-semibold hover:border-primary/50 disabled:opacity-50";

/** Kabinet: e'lon holati amallari — yashirish/qaytarish, moderatsiyaga yuborish, o'chirish (tasdiq bilan) */
export function ListingActions({
  id,
  status,
}: {
  id: string;
  status: MasterListingStatus;
}) {
  const { t } = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = (fn: () => Promise<{ ok: boolean }>) =>
    start(async () => {
      setError(null);
      const res = await fn();
      if (!res.ok) setError(t("masters.form.errors.generic"));
      router.refresh();
    });

  return (
    <div className="flex flex-wrap gap-2" data-masters-listing-actions>
      {status === "active" ? (
        <button
          type="button"
          className={btn}
          disabled={pending}
          onClick={() =>
            run(() =>
              callAction(() =>
                setMasterListingStatus({ id, status: "hidden" }),
              ),
            )
          }
        >
          <EyeOff className="size-4" aria-hidden /> {t("masters.cab.hide")}
        </button>
      ) : null}
      {status === "hidden" ? (
        <button
          type="button"
          className={btn}
          disabled={pending}
          onClick={() =>
            run(() =>
              callAction(() =>
                setMasterListingStatus({ id, status: "active" }),
              ),
            )
          }
        >
          <Eye className="size-4" aria-hidden /> {t("masters.cab.show")}
        </button>
      ) : null}
      {status === "draft" ? (
        <button
          type="button"
          className={cn(
            btn,
            "border-primary bg-primary text-primary-foreground hover:bg-primary-hover",
          )}
          disabled={pending}
          onClick={() =>
            run(() =>
              callAction(() =>
                setMasterListingStatus({ id, status: "pending_review" }),
              ),
            )
          }
        >
          <Send className="size-4" aria-hidden /> {t("masters.cab.submit")}
        </button>
      ) : null}
      <button
        type="button"
        className={cn(btn, "text-destructive")}
        disabled={pending}
        onClick={() => setConfirm(true)}
      >
        <Trash2 className="size-4" aria-hidden /> {t("masters.cab.delete")}
      </button>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={t("masters.cab.delete")}
        description={t("masters.cab.delete_confirm")}
        confirmLabel={t("masters.cab.delete")}
        cancelLabel={t("common.actions.cancel")}
        destructive
        loading={pending}
        onConfirm={() => {
          setConfirm(false);
          run(() => callAction(() => deleteMasterListing({ id })));
        }}
      />
      {error ? (
        <p
          role="alert"
          className="w-full text-sm font-semibold text-destructive"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Mijoz so'rovi holati: yangi → ko'rildi → bajarildi */
export function RequestStatusButtons({
  id,
  status,
}: {
  id: string;
  status: MasterRequestStatus;
}) {
  const { t } = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const set = (s: MasterRequestStatus) =>
    start(async () => {
      await callAction(() => setMasterRequestStatus({ id, status: s }));
      router.refresh();
    });
  return (
    <div className="flex flex-wrap gap-2">
      {status === "new" ? (
        <button
          type="button"
          className={btn}
          disabled={pending}
          onClick={() => set("seen")}
        >
          {t("masters.cab.mark_seen")}
        </button>
      ) : null}
      {status !== "done" ? (
        <button
          type="button"
          className={btn}
          disabled={pending}
          onClick={() => set("done")}
        >
          {t("masters.cab.mark_done")}
        </button>
      ) : null}
    </div>
  );
}
