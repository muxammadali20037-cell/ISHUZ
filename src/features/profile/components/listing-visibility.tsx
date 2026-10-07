"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Eye, EyeOff, Send, PartyPopper, ShieldCheck } from "lucide-react";
import { requestPayment } from "@/features/billing/components/payment-dialog";
import { celebrate } from "@/lib/celebrate";
import { useT } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { updateVisibility, updateWorkerStatus } from "../actions";

type Mode = "search" | "applied" | "hidden";

/**
 * Ish qidirish e'loni ko'rinishi (spec §10): qidiruvda ko'rinsin / faqat ariza yuborgan ish beruvchilar ko'rsin /
 * hozircha yashirin. "Ish topdim" — e'lon to'xtatiladi (keyin qayta faollashtiriladi).
 */
export function ListingVisibility({
  workerId,
  isPublic,
  status,
  listedUntil,
}: {
  workerId: string;
  isPublic: boolean;
  status: "active" | "open" | "not_looking";
  listedUntil: string | null;
}) {
  const { t } = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const mode: Mode = status === "not_looking" ? "hidden" : isPublic ? "search" : "applied";

  const apply = (next: Mode, found = false) =>
    start(async () => {
      const r1 = await updateVisibility({ is_public: next === "search" });
      const r2 = await updateWorkerStatus({ status: next === "hidden" ? "not_looking" : status === "not_looking" ? "active" : status });
      if (!r1.ok || !r2.ok) {
        // 10 kunlik bepul e'lon ishlatilgan — qidiruvga chiqish to'lov orqali
        if ((!r1.ok && r1.error === "listing_payment_required") || (!r2.ok && r2.error === "listing_payment_required")) {
          requestPayment({ purpose: "worker_listing", targetId: workerId });
          router.refresh();
          return;
        }
        toast.error(t("common.errors.generic"));
        return;
      }
      if (found) celebrate();
      toast.success(found ? t("profile.listing.found_done") : t("profile.listing.saved"));
      router.refresh();
    });

  // Har bir holat o'z rangida: yashil — hamma ko'radi, ko'k — faqat murojaat qilinganlar, kulrang — yashirin
  const options: { key: Mode; icon: typeof Eye; title: string; desc: string; tone: { on: string; icon: string; dot: string } }[] = [
    {
      key: "search",
      icon: Eye,
      title: t("profile.listing.mode_search"),
      desc: t("profile.listing.mode_search_desc"),
      tone: { on: "border-success bg-success-soft", icon: "bg-success text-success-foreground", dot: "bg-success" },
    },
    {
      key: "applied",
      icon: Send,
      title: t("profile.listing.mode_applied"),
      desc: t("profile.listing.mode_applied_desc"),
      tone: { on: "border-primary bg-primary-soft", icon: "bg-primary text-primary-foreground", dot: "bg-primary" },
    },
    {
      key: "hidden",
      icon: EyeOff,
      title: t("profile.listing.mode_hidden"),
      desc: t("profile.listing.mode_hidden_desc"),
      tone: { on: "border-warning bg-warning-soft", icon: "bg-warning text-warning-foreground", dot: "bg-warning" },
    },
  ];

  return (
    <div className="space-y-3">
      <div role="radiogroup" aria-label={t("profile.listing.visibility")} className="space-y-2">
        {options.map((o) => (
          <button
            key={o.key}
            type="button"
            role="radio"
            aria-checked={mode === o.key}
            disabled={pending}
            onClick={() => mode !== o.key && apply(o.key)}
            className={cn(
              "flex w-full items-start gap-3 rounded-2xl border-2 p-4 text-left transition-all disabled:opacity-60",
              mode === o.key ? cn(o.tone.on, "shadow-sm") : "border-border bg-card hover:border-primary/40",
            )}
          >
            <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl", mode === o.key ? o.tone.icon : "bg-secondary text-muted-foreground")}>
              <o.icon className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2 font-semibold">
                {o.title}
                {mode === o.key ? <span className={cn("size-2 rounded-full", o.tone.dot)} aria-hidden /> : null}
              </span>
              <span className="block text-sm text-muted-foreground">{o.desc}</span>
            </span>
          </button>
        ))}
      </div>
      {listedUntil ? <ListingTerm until={listedUntil} active={mode === "search"} onExtend={() => requestPayment({ purpose: "worker_listing", targetId: workerId })} /> : null}
      <p className="flex items-start gap-2 rounded-2xl border border-primary/20 bg-primary-soft/60 p-3 text-sm text-foreground">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
        {t("profile.listing.phone_note")}
      </p>
      {mode !== "hidden" ? (
        <Button size="lg" className="w-full bg-success text-success-foreground hover:bg-success/90" disabled={pending} onClick={() => apply("hidden", true)}>
          <PartyPopper className="size-5" /> {t("profile.listing.found_job")}
        </Button>
      ) : (
        <Button size="lg" className="w-full" disabled={pending} onClick={() => apply("search")}>
          {t("profile.listing.reactivate")}
        </Button>
      )}
    </div>
  );
}

/** E'lon muddati: necha kun qolgani (rangli) + 10 kunga uzaytirish */
function ListingTerm({ until, active, onExtend }: { until: string; active: boolean; onExtend: () => void }) {
  const { t } = useT();
  const [now] = useState(() => Date.now());
  const ms = new Date(until).getTime() - now;
  const days = Math.max(0, Math.ceil(ms / 86_400_000));
  const expired = ms <= 0 || !active;
  const soon = !expired && days <= 2;
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-2xl border-2 p-4",
        expired ? "border-destructive/40 bg-destructive/5" : soon ? "border-warning bg-warning-soft" : "border-success/40 bg-success-soft",
      )}
    >
      <CalendarClock className={cn("size-6 shrink-0", expired ? "text-destructive" : soon ? "text-warning" : "text-success")} />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">
          {expired ? t("profile.listing.term_expired") : t("profile.listing.term_left", { days, date: new Date(until).toLocaleDateString("ru-RU") })}
        </p>
        <p className="text-xs text-muted-foreground">{t("profile.listing.term_hint")}</p>
      </div>
      <Button size="sm" variant={expired || soon ? "default" : "outline"} onClick={onExtend}>
        {t("profile.listing.extend")}
      </Button>
    </div>
  );
}
