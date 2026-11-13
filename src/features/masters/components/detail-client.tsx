"use client";

import { useEffect, useState, type FormEvent } from "react";
import { CheckCircle2, Phone, Send, Star } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import {
  formatPhone,
  formatPhoneAsYouType,
  normalizePhone,
} from "@/lib/format";
import { callAction } from "@/lib/action-call";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  addMasterReview,
  createMasterRequest,
  hitMasterListing,
} from "../actions";

/** Sahifa ochilganda ko'rish hisoblanadi (demo e'londa bazada hisoblanmaydi) */
export function ViewCounter({ id }: { id: string }) {
  useEffect(() => {
    void hitMasterListing({ id, kind: "view" }).catch(() => undefined);
  }, [id]);
  return null;
}

/** Telefon: egasi rozilik bergan — tel: havola, bosilganda hisoblanadi */
export function PhoneButton({ id, phone }: { id: string; phone: string }) {
  const { t } = useT();
  return (
    <a
      href={`tel:${phone}`}
      onClick={() =>
        void hitMasterListing({ id, kind: "phone" }).catch(() => undefined)
      }
      className="press inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-base font-bold text-primary-foreground hover:bg-primary-hover"
      data-masters-phone
    >
      <Phone className="size-5" aria-hidden /> {t("masters.card.call")} ·{" "}
      {formatPhone(phone)}
    </a>
  );
}

const field =
  "h-12 w-full rounded-xl border border-input bg-background px-3 text-base outline-none focus:border-primary focus:ring-2 focus:ring-ring/25 aria-[invalid=true]:border-destructive";

/** Mijoz so'rovi: ism, telefon, xabar → master_request_create (mehmon ham) */
export function RequestForm({
  listingId,
  defaultName,
}: {
  listingId: string;
  defaultName?: string;
}) {
  const { t } = useT();
  const [name, setName] = useState(defaultName ?? "");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [state, setState] = useState<{
    kind: "idle" | "sending" | "sent" | "error";
    text?: string;
  }>({ kind: "idle" });
  const phoneOk = normalizePhone(phone) !== null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2 || !phoneOk) {
      setState({ kind: "error", text: t("masters.form.errors.required") });
      return;
    }
    setState({ kind: "sending" });
    const res = await callAction(() =>
      createMasterRequest({
        listingId,
        name: name.trim(),
        phone: normalizePhone(phone),
        message: message.trim() || undefined,
      }),
    );
    if (res.ok) setState({ kind: "sent" });
    else
      setState({
        kind: "error",
        text:
          res.error === "own"
            ? t("masters.request.own")
            : res.error === "rate_limited"
              ? t("masters.request.limit")
              : res.error === "prohibited"
                ? t("masters.request.prohibited")
                : res.error === "blocked"
                  ? t("masters.blocked")
                  : t("masters.request.error"),
      });
  };

  if (state.kind === "sent") {
    return (
      <div
        className="rounded-2xl bg-primary-soft p-5"
        role="status"
        data-masters-request-sent
      >
        <p className="flex items-center gap-2 text-lg font-bold text-primary-ink">
          <CheckCircle2 className="size-6" aria-hidden />{" "}
          {t("masters.request.sent_title")}
        </p>
        <p className="mt-1 text-foreground">{t("masters.request.sent_desc")}</p>
      </div>
    );
  }
  return (
    <form onSubmit={submit} className="space-y-3" data-masters-request>
      <label className="grid gap-1 text-sm font-semibold">
        {t("masters.request.name")}
        <input
          value={name}
          onChange={(e) => setName(e.target.value.slice(0, 80))}
          required
          minLength={2}
          className={field}
          autoComplete="name"
        />
      </label>
      <label className="grid gap-1 text-sm font-semibold">
        {t("masters.request.phone")}
        <input
          value={phone}
          onChange={(e) => setPhone(formatPhoneAsYouType(e.target.value))}
          inputMode="tel"
          autoComplete="tel"
          placeholder="+998 90 123 45 67"
          aria-invalid={phone.length > 0 && !phoneOk}
          className={field}
        />
      </label>
      <label className="grid gap-1 text-sm font-semibold">
        {t("masters.request.message")}
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value.slice(0, 1000))}
          rows={3}
          className={cn(field, "h-auto py-2.5")}
        />
      </label>
      {state.kind === "error" ? (
        <p role="alert" className="text-sm font-semibold text-destructive">
          {state.text}
        </p>
      ) : null}
      <Button
        type="submit"
        size="lg"
        fullWidth
        loading={state.kind === "sending"}
        className="text-base"
      >
        <Send className="size-5" aria-hidden />{" "}
        {state.kind === "sending"
          ? t("masters.request.sending")
          : t("masters.request.send")}
      </Button>
    </form>
  );
}

/** Sharh: 1–5 yulduz + matn; faqat kirgan foydalanuvchi (egasi emas) */
export function ReviewForm({ listingId }: { listingId: string }) {
  const { t } = useT();
  const [rating, setRating] = useState(0);
  const [text, setText] = useState("");
  const [state, setState] = useState<{
    kind: "idle" | "sending" | "sent" | "error";
    text?: string;
  }>({ kind: "idle" });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!rating) return;
    setState({ kind: "sending" });
    const res = await callAction(() =>
      addMasterReview({ listingId, rating, text: text.trim() || undefined }),
    );
    if (res.ok) setState({ kind: "sent" });
    else
      setState({
        kind: "error",
        text:
          res.error === "own"
            ? t("masters.review.own")
            : res.error === "prohibited"
              ? t("masters.review.prohibited")
              : res.error === "blocked"
                ? t("masters.blocked")
                : t("masters.review.error"),
      });
  };

  if (state.kind === "sent") {
    return (
      <p
        className="rounded-xl bg-primary-soft px-4 py-3 font-semibold text-primary-ink"
        role="status"
        data-masters-review-sent
      >
        {t("masters.review.sent")}
      </p>
    );
  }
  return (
    <form
      onSubmit={submit}
      className="space-y-3 rounded-2xl border border-border bg-card p-4"
      data-masters-review
    >
      <p className="text-base font-bold">{t("masters.review.title")}</p>
      <div
        role="radiogroup"
        aria-label={t("masters.review.rating")}
        className="flex gap-1"
      >
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={rating === n}
            aria-label={t("masters.review.star", { n })}
            onClick={() => setRating(n)}
            className="press flex size-11 items-center justify-center rounded-lg hover:bg-secondary"
          >
            <Star
              className={cn(
                "size-7",
                n <= rating ? "text-warning" : "text-border",
              )}
              fill={n <= rating ? "currentColor" : "none"}
              aria-hidden
            />
          </button>
        ))}
      </div>
      <label className="grid gap-1 text-sm font-semibold">
        {t("masters.review.text")}
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, 1000))}
          rows={3}
          className={cn(field, "h-auto py-2.5")}
        />
      </label>
      {state.kind === "error" ? (
        <p role="alert" className="text-sm font-semibold text-destructive">
          {state.text}
        </p>
      ) : null}
      <Button
        type="submit"
        disabled={!rating}
        loading={state.kind === "sending"}
        className="h-11 text-base"
      >
        {t("masters.review.send")}
      </Button>
    </form>
  );
}
