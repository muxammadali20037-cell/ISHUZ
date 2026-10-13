"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BriefcaseBusiness, UsersRound } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { callAction } from "@/lib/action-call";
import { ConfirmDialog } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { chooseMode } from "../actions";
import type { AppMode } from "../mode";

/**
 * Rejim almashtirgich ("Ish izlovchi" | "Ish beruvchi"): boshqa rejim faqat tasdiqlangandan keyin yoqiladi —
 * tasodifan bosib, boshqa bo'limga kirib qolish bo'lmaydi.
 */
export function ModeSwitch({ mode, className }: { mode: AppMode; className?: string }) {
  const { t } = useT();
  const router = useRouter();
  const [ask, setAsk] = useState<AppMode | null>(null);
  const [pending, start] = useTransition();
  const items = [
    { mode: "worker" as const, icon: BriefcaseBusiness, label: t("easy.mode.worker_short") },
    { mode: "employer" as const, icon: UsersRound, label: t("easy.mode.employer_short") },
  ];
  const confirm = () =>
    start(async () => {
      if (!ask) return;
      const res = await callAction(() => chooseMode(ask));
      if (!res.ok) {
        toast.error(t("common.errors.generic"));
        return;
      }
      setAsk(null);
      router.refresh();
    });

  return (
    <>
      <div role="radiogroup" aria-label={t("easy.mode.switch_label")} className={cn("mx-auto grid max-w-md grid-cols-2 gap-1 rounded-2xl border border-border bg-secondary p-1", className)}>
        {items.map((it) => {
          const on = it.mode === mode;
          return (
            <button
              key={it.mode}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => (on ? undefined : setAsk(it.mode))}
              data-track="mode_switch"
              data-track-to={it.mode}
              className={cn(
                "flex min-h-11 items-center justify-center gap-2 rounded-xl px-2 text-base font-bold transition-colors",
                on ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <it.icon className="size-5 shrink-0" aria-hidden /> <span className="truncate">{it.label}</span>
            </button>
          );
        })}
      </div>
      <ConfirmDialog
        open={ask !== null}
        onOpenChange={(open) => (open ? undefined : setAsk(null))}
        title={ask === "employer" ? t("easy.mode.to_employer_title") : t("easy.mode.to_worker_title")}
        description={ask === "employer" ? t("easy.mode.to_employer_desc") : t("easy.mode.to_worker_desc")}
        confirmLabel={t("easy.mode.confirm")}
        cancelLabel={t("easy.mode.cancel")}
        onConfirm={confirm}
        loading={pending}
      />
    </>
  );
}
