"use client";

import { useState, useTransition } from "react";
import { BriefcaseBusiness, Check, UsersRound } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { callAction } from "@/lib/action-call";
import { chooseMode } from "@/features/mode/actions";
import type { AppMode } from "@/features/mode/mode";
import { cn } from "@/lib/utils";

/**
 * Kirish sahifasidagi rol kartalari (S3): "Kim sifatida kirasiz?" — tanlov qurilmada saqlanadi (kirgach profilga ham yoziladi),
 * kirgandan keyin ilova shu rolning bosh sahifasi va menyusi bilan ochiladi. Tanlamasa ham kirish mumkin.
 */
export function AuthRoleCards({ initial }: { initial: AppMode | null }) {
  const { t } = useT();
  const [mode, setMode] = useState<AppMode | null>(initial);
  const [pending, start] = useTransition();
  const pick = (next: AppMode) => {
    if (next === mode || pending) return;
    const prev = mode;
    setMode(next);
    start(async () => {
      const res = await callAction(() => chooseMode(next));
      if (!res.ok) setMode(prev);
    });
  };
  const items = [
    { mode: "worker" as const, icon: BriefcaseBusiness, title: t("auth.role.worker"), desc: t("auth.role.worker_desc") },
    { mode: "employer" as const, icon: UsersRound, title: t("auth.role.employer"), desc: t("auth.role.employer_desc") },
  ];
  return (
    <fieldset className="space-y-2">
      <legend className="mb-2 text-base font-bold">{t("auth.role.title")}</legend>
      <div role="radiogroup" aria-label={t("auth.role.title")} className="grid grid-cols-2 gap-2">
        {items.map((it) => {
          const on = mode === it.mode;
          return (
            <button
              key={it.mode}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => pick(it.mode)}
              data-track="auth_role"
              data-track-to={it.mode}
              className={cn(
                "press relative flex flex-col items-start gap-1 rounded-2xl border-2 p-3 text-left transition-colors",
                on ? "border-primary bg-primary-soft" : "border-border bg-card hover:border-primary/50",
              )}
            >
              <span className={cn("flex size-9 items-center justify-center rounded-xl", on ? "bg-primary text-primary-foreground" : "bg-primary-soft text-primary")} aria-hidden>
                <it.icon className="size-5" />
              </span>
              <span className="font-bold leading-tight">{it.title}</span>
              <span className="text-sm leading-snug text-muted-foreground">{it.desc}</span>
              {on ? <Check className="absolute right-2.5 top-2.5 size-5 text-primary" aria-hidden /> : null}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
