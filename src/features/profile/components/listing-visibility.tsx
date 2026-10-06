"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Send, PartyPopper } from "lucide-react";
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
export function ListingVisibility({ isPublic, status }: { isPublic: boolean; status: "active" | "open" | "not_looking" }) {
  const { t } = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const mode: Mode = status === "not_looking" ? "hidden" : isPublic ? "search" : "applied";

  const apply = (next: Mode, found = false) =>
    start(async () => {
      const r1 = await updateVisibility({ is_public: next === "search" });
      const r2 = await updateWorkerStatus({ status: next === "hidden" ? "not_looking" : status === "not_looking" ? "active" : status });
      if (!r1.ok || !r2.ok) {
        toast.error(t("common.errors.generic"));
        return;
      }
      toast.success(found ? t("profile.listing.found_done") : t("profile.listing.saved"));
      router.refresh();
    });

  const options: { key: Mode; icon: typeof Eye; title: string; desc: string }[] = [
    { key: "search", icon: Eye, title: t("profile.listing.mode_search"), desc: t("profile.listing.mode_search_desc") },
    { key: "applied", icon: Send, title: t("profile.listing.mode_applied"), desc: t("profile.listing.mode_applied_desc") },
    { key: "hidden", icon: EyeOff, title: t("profile.listing.mode_hidden"), desc: t("profile.listing.mode_hidden_desc") },
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
              "flex w-full items-start gap-3 rounded-2xl border-2 p-4 text-left transition-colors disabled:opacity-60",
              mode === o.key ? "border-primary bg-primary-soft/50" : "border-border bg-card hover:border-primary/50",
            )}
          >
            <o.icon className={cn("mt-0.5 size-5 shrink-0", mode === o.key ? "text-primary" : "text-muted-foreground")} />
            <span>
              <span className="block font-semibold">{o.title}</span>
              <span className="block text-sm text-muted-foreground">{o.desc}</span>
            </span>
          </button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">{t("profile.listing.phone_note")}</p>
      {mode !== "hidden" ? (
        <Button variant="outline" size="lg" className="w-full" disabled={pending} onClick={() => apply("hidden", true)}>
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
