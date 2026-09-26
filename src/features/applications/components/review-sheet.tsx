"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Star } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";
import { Dialog, Sheet } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { toast } from "@/components/ui/toast";
import { createReview } from "../actions";
import { actionErrorText } from "../errors";
import { StarRating } from "./star-rating";

export type ReviewSource = { kind: "application"; applicationId: string; vacancyId?: string } | { kind: "offer"; offerId: string };

/**
 * "Baholash" tugmasi + bottom sheet (1–5 yulduz + matn) → create_review RPC.
 * Ishchi ish beruvchini, ish beruvchi nomzodni baholaydi (RPC tomonni o'zi aniqlaydi).
 */
export function ReviewSheet({ source, label, variant = "default", fullWidth, className }: { source: ReviewSource; label: string; variant?: "default" | "soft" | "outline"; fullWidth?: boolean; className?: string }) {
  const { t } = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [text, setText] = useState("");
  const [pending, startTransition] = useTransition();

  const submit = () => {
    if (rating < 1) return;
    startTransition(async () => {
      const res = await createReview(
        source.kind === "application" ? { applicationId: source.applicationId, vacancyId: source.vacancyId, rating, text } : { offerId: source.offerId, rating, text },
      );
      if (!res.ok) {
        toast.error(actionErrorText(t, res.error));
        return;
      }
      toast.success(t("applications.review.sent"), t("applications.review.sent_desc"));
      setOpen(false);
      setRating(0);
      setText("");
      router.refresh();
    });
  };

  return (
    <>
      <Button type="button" variant={variant} fullWidth={fullWidth} className={className} onClick={() => setOpen(true)}>
        <Star className="size-4" />
        {label}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <Sheet
          title={t("applications.review.title")}
          description={t("applications.review.desc")}
          footer={
            <Button fullWidth onClick={submit} loading={pending} disabled={rating < 1}>
              {t("applications.review.submit")}
            </Button>
          }
        >
          <Field label={t("applications.review.rating")} required>
            <StarRating value={rating} onChange={setRating} size="lg" />
          </Field>
          <Field label={t("applications.review.text")} htmlFor="review-text" hint={t("common.labels.optional")} className="mt-4">
            <Textarea
              id="review-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={2000}
              placeholder={t("applications.review.text_placeholder")}
              className="min-h-[110px]"
            />
          </Field>
        </Sheet>
      </Dialog>
    </>
  );
}
