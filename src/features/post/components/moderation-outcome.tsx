"use client";

import Link from "next/link";
import { useState, useTransition, type ReactNode } from "react";
import { AlertTriangle, Clock3, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import { requestAppeal } from "../actions";
import type { ListingStateInfo } from "../types";

/**
 * Moderatsiya natijasi (joylash tugmasidan keyin): faqat haqiqiy holat.
 *  - moderation_pending — "E'loningiz saqlandi. Tekshiruv tugagach natijasini bildiramiz."
 *  - review — moderator ko'radi;
 *  - rejected — sodda sabab, tuzatiladigan maydonlar, "O'zgartirish" va "Qayta ko'rib chiqishni so'rash";
 *  - verification_pending — tekshiruvdan o'tdi, ish beruvchi tasdiqlangach chiqadi.
 */
export function ModerationOutcome({
  entity,
  id,
  info,
  fieldLabels,
  onEdit,
  children,
}: {
  entity: "vacancy" | "worker";
  id: string;
  info: ListingStateInfo;
  /** maydon kaliti → foydalanuvchiga ko'rinadigan nom */
  fieldLabels: Record<string, string>;
  onEdit: () => void;
  children?: ReactNode;
}) {
  const { t } = useT();
  const [state, setState] = useState(info);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const appeal = () =>
    start(async () => {
      const res = await requestAppeal({ entity, id });
      if (!res.ok || !res.data) {
        const key = `easy.errors.${res.ok ? "generic" : res.error}`;
        const msg = t(key);
        setError(msg === key ? t("easy.errors.generic") : msg);
        return;
      }
      setState(res.data);
    });

  const rejected = state.state === "rejected";
  const verification = state.state === "verification_pending";
  const key = rejected ? "rejected" : verification ? "verification" : state.state === "review" ? "review" : "pending";
  const Icon = rejected ? AlertTriangle : verification ? ShieldCheck : Clock3;
  const fields = state.fields.map((f) => fieldLabels[f] ?? fieldLabels.description ?? f).filter((v, i, a) => a.indexOf(v) === i);

  return (
    <div className="container-narrow py-8 text-lg sm:py-12" role="status" aria-live="polite">
      <div className={cn("rounded-3xl border-2 p-6 text-center sm:p-8", rejected ? "border-destructive/60 bg-destructive/5" : "border-primary/40 bg-primary-soft/60")}>
        <Icon className={cn("mx-auto size-16", rejected ? "text-destructive" : "text-primary")} aria-hidden />
        <h1 className="mt-4 text-2xl font-extrabold leading-tight sm:text-3xl">{t(`easy.moderation.${key}_title`)}</h1>
        <p className="mx-auto mt-2 max-w-md text-lg text-foreground/80">{t(`easy.moderation.${key}_desc`)}</p>
        {rejected && state.message ? <p className="mx-auto mt-3 max-w-md rounded-2xl bg-background/80 p-3 text-base">{state.message}</p> : null}
        {rejected && fields.length ? (
          <p className="mt-3 text-base font-semibold text-destructive">{t("easy.moderation.fix_fields", { fields: fields.join(", ") })}</p>
        ) : null}
        {error ? <p className="mt-3 text-base font-semibold text-destructive" role="alert">{error}</p> : null}
      </div>
      {children}
      <div className="mt-6 grid gap-3">
        {rejected ? (
          <>
            <Button size="xl" className="h-14 w-full text-lg" onClick={onEdit}>
              {t("easy.moderation.edit")}
            </Button>
            {state.canAppeal ? (
              <Button size="xl" variant="outline" className="h-14 w-full text-lg" disabled={pending} onClick={appeal}>
                {pending ? t("easy.wizard.saving") : t("easy.moderation.appeal")}
              </Button>
            ) : null}
          </>
        ) : null}
        {verification ? (
          <Button asChild size="xl" className="h-14 w-full text-lg">
            <Link href="/cabinet/verification">{t("easy.moderation.verify_cta")}</Link>
          </Button>
        ) : null}
        <Button asChild size="xl" variant={rejected || verification ? "outline" : "default"} className="h-14 w-full text-lg">
          <Link href="/cabinet">{t("easy.cabinet.title")}</Link>
        </Button>
      </div>
    </div>
  );
}
