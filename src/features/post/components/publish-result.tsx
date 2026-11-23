"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Check, Clock3, MapPin, Rocket, Send } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { CheckoutPanel } from "@/features/billing/components/checkout-panel";
import { cn } from "@/lib/utils";
import { SalaryText } from "@/components/shared/salary-text";
import type { Enums } from "@/types/database.types";

type Action = { label: string; href: string; primary?: boolean; icon?: ReactNode };

/** Joylangan e'lonning qisqa ko'rinishi (joylash paytidagi javoblardan) */
export interface PublishedListing {
  title: string;
  /** maosh — saytdagi kartalar bilan bir xil yozuvda ("kamida 5 000 000 so'm/oy", "Kelishiladi") */
  salary?: { from: number | null; to: number | null; type?: Enums<"salary_type"> | null; negotiable?: boolean } | null;
  place?: string | null;
}

/**
 * Saqlashdan keyingi ekran — faqat HAQIQIY holat: "joylandi" faqat qidiruvda ko'rinsa;
 * to'lov kerak yoki tekshiruvda bo'lsa shuni aniq aytadi va keyingi qadamni beradi.
 * To'lov kerak bo'lsa — to'lov paneli shu ekranning o'zida (nima olinadi, narx, usullar): Payme/Click yoki balansgacha 1 bosish.
 *
 * Ko'rinish (ega, 2026-11-23 — "A, yengil" varianti; katta yashil ramka yoqmadi): yumaloq belgi, sarlavha va qisqa matn;
 * joylangan e'lonning kartasi ("Faol · Qidiruvda ko'rinyapti" — faqat haqiqatan joylanganda); ostida bitta katta tugma, qolganlari
 * va "Ulashish" — kichikroq, yonma-yon.
 */
export function PublishResult({
  tone,
  title,
  description,
  actions,
  payment,
  listing,
  share,
  children,
}: {
  tone: "success" | "review" | "payment";
  title: string;
  description: string;
  actions: Action[];
  payment?: { purpose: "worker_listing" | "vacancy_publish"; targetId: string };
  listing?: PublishedListing | null;
  /** "Ulashish" — e'lonning ochiq sahifasi (faqat joylanganda) */
  share?: { path: string; text: string } | null;
  children?: ReactNode;
}) {
  const { t } = useT();
  const Icon = tone === "success" ? Check : tone === "review" ? Clock3 : Rocket;
  const live = tone === "success";
  // katta tugma — "primary" belgilangani (bo'lmasa birinchisi; to'lov kerak bo'lsa — to'lov paneli asosiy, tugmalar kichik)
  const main = actions.find((a) => a.primary) ?? (payment ? undefined : actions[0]);
  const rest = actions.filter((a) => a !== main);
  const small = rest.length + (share && live ? 1 : 0);

  const onShare = async () => {
    if (!share) return;
    const url = `${window.location.origin}${share.path}`;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: share.text, text: share.text, url });
        return;
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t("easy.publish.link_copied"));
    } catch {
      toast.error(t("common.errors.generic"));
    }
  };

  return (
    <div className="container-narrow py-8 sm:py-12" role="status" aria-live="polite" data-publish-result={tone}>
      <div className="flex flex-col items-center text-center">
        <span className={cn("flex size-16 items-center justify-center rounded-full", live ? "bg-success-soft text-success" : "bg-primary-soft text-primary-ink")} aria-hidden>
          <Icon className="size-9" strokeWidth={live ? 3 : 2.25} />
        </span>
        <h1 className="mt-4 text-3xl font-extrabold leading-tight [overflow-wrap:anywhere]">{title}</h1>
        <p className="mt-2 max-w-sm text-base text-muted-foreground">{description}</p>
      </div>

      {listing ? (
        <article className="mt-6 rounded-2xl border border-border bg-card p-4 shadow-sm" data-publish-listing>
          {live ? (
            <p className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-success-soft px-2.5 py-1 text-sm font-bold text-success">
                <span className="size-2 rounded-full bg-success" aria-hidden /> {t("easy.publish.active")}
              </span>
              <span className="text-sm text-muted-foreground">{t("easy.publish.active_hint")}</span>
            </p>
          ) : null}
          <h2 className={cn("text-xl font-extrabold leading-snug [overflow-wrap:anywhere]", live && "mt-3")}>{listing.title}</h2>
          {listing.salary ? (
            <p className="mt-2 inline-flex rounded-md bg-primary-soft px-2.5 py-1 text-sm text-primary-ink">
              <SalaryText {...listing.salary} className="font-bold" />
            </p>
          ) : null}
          {listing.place ? (
            <p className="mt-2 flex items-start gap-1.5 text-sm text-muted-foreground">
              <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden /> <span className="min-w-0">{listing.place}</span>
            </p>
          ) : null}
        </article>
      ) : null}

      {children}
      {payment ? <CheckoutPanel purpose={payment.purpose} targetId={payment.targetId} variant="inline" className="mt-6" /> : null}

      <div className="mt-6 grid gap-3">
        {main ? (
          <Button asChild size="xl" className="h-14 w-full text-lg" data-publish-main>
            <Link href={main.href}>
              {main.icon}
              {main.label}
            </Link>
          </Button>
        ) : null}
        {small ? (
          // ikkita kichik tugma — yonma-yon (tor ekranda ham); bittasi yoki uchtasi — ustma-ust
          <div className={cn("grid gap-3", small === 2 ? "grid-cols-2" : "grid-cols-1")}>
            {rest.map((a) => (
              <Button key={a.href} asChild variant="outline" size="xl" className="h-auto min-h-12 whitespace-normal px-3 py-2 text-base">
                <Link href={a.href}>
                  {a.icon}
                  {a.label}
                </Link>
              </Button>
            ))}
            {share && live ? (
              <Button type="button" variant="outline" size="xl" className="h-auto min-h-12 whitespace-normal px-3 py-2 text-base" onClick={onShare} data-publish-share>
                <Send className="size-5 shrink-0" aria-hidden />
                {t("easy.publish.share")}
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
