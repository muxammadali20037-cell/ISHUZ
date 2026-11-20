"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { BriefcaseBusiness, Building2, ChevronRight, Loader2 } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import type { AppMode } from "@/features/mode/mode";
import { cn } from "@/lib/utils";
import { pickRole, pickWelcomeRole } from "../actions";

/**
 * Rol tanlash (ega, 2026-11-20: "rasmlar yoqmayapti — savol bilan kirish kerak: «O'zingizga mos ish qidiryapsizmi?»,
 * ish beruvchiga «Korxonangizga ishchi qidiryapsizmi?»"): ikkita katta savol-karta, rasmsiz. Bitta bosish — tanlanadi va
 * darhol davom etadi ("Davom etish" tugmasi yo'q). Har karta — forma tugmasi (name="mode"), shuning uchun JS'siz ham ishlaydi.
 * Tanlov — mavjud chooseMode (qurilma cookie'si + kirgan bo'lsa active_role). Rollar aralashmaydi.
 * `welcome` — xush kelibsiz ekranidan: mehmon darhol asosiy ekranga (kirish so'ralmaydi), kirgan, lekin profili yo'q
 * foydalanuvchi — oqim davom etadi (pickWelcomeRole).
 */
export function RolePicker({ initial, next, welcome = null }: { initial: AppMode | null; next: string; welcome?: { locale: string } | null }) {
  const { t } = useT();
  const [picked, setPicked] = useState<AppMode | null>(null);
  const items = [
    { mode: "worker" as const, icon: BriefcaseBusiness, title: t("welcome.entry.role.worker_title"), desc: t("welcome.entry.role.worker_desc") },
    { mode: "employer" as const, icon: Building2, title: t("welcome.entry.role.employer_title"), desc: t("welcome.entry.role.employer_desc") },
  ];
  return (
    <form action={welcome ? pickWelcomeRole : pickRole} className="flex flex-col" data-role-form={welcome ? "welcome" : "role"}>
      {next ? <input type="hidden" name="next" value={next} /> : null}
      {welcome ? <input type="hidden" name="locale" value={welcome.locale} /> : null}
      <div role="group" aria-label={t("welcome.entry.role.title")} className="mt-6 grid gap-3 sm:grid-cols-2 sm:gap-4">
        {items.map((it) => (
          <RoleCard key={it.mode} {...it} last={initial === it.mode} lastLabel={t("welcome.entry.role.last")} picked={picked === it.mode} onPick={() => setPicked(it.mode)} />
        ))}
      </div>
      <p className="mt-4 text-center text-sm text-muted-foreground">{t("welcome.entry.role.note")}</p>
    </form>
  );
}

function RoleCard({
  mode,
  icon: Icon,
  title,
  desc,
  last,
  lastLabel,
  picked,
  onPick,
}: {
  mode: AppMode;
  icon: typeof BriefcaseBusiness;
  title: string;
  desc: string;
  last: boolean;
  lastLabel: string;
  picked: boolean;
  onPick: () => void;
}) {
  const { pending } = useFormStatus();
  const busy = pending && picked;
  return (
    <button
      type="submit"
      name="mode"
      value={mode}
      onClick={onPick}
      disabled={pending}
      data-testid={`role-${mode}`}
      data-role-choice={mode}
      aria-busy={busy || undefined}
      className={cn(
        "press group relative flex w-full items-center gap-4 rounded-2xl border-2 bg-card p-4 text-left shadow-sm transition-colors disabled:opacity-70 sm:flex-col sm:items-start sm:p-5",
        last || busy ? "border-primary bg-primary-soft" : "border-border hover:border-primary/50",
      )}
    >
      <span className={cn("flex size-14 shrink-0 items-center justify-center rounded-2xl", mode === "employer" ? "bg-success-soft text-success" : "bg-primary-soft text-primary-ink")} aria-hidden>
        <Icon className="size-7" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-lg font-extrabold leading-snug [overflow-wrap:anywhere]">{title}</span>
        <span className="mt-1 block text-sm leading-snug text-muted-foreground [overflow-wrap:anywhere]">{desc}</span>
        {last ? <span className="mt-2 inline-block rounded-full bg-card px-2 py-0.5 text-xs font-semibold text-primary-ink">{lastLabel}</span> : null}
      </span>
      {busy ? (
        <Loader2 className="size-6 shrink-0 animate-spin text-primary-ink" aria-hidden />
      ) : (
        <ChevronRight className="size-6 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 sm:hidden" aria-hidden />
      )}
    </button>
  );
}
