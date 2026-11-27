"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { BriefcaseBusiness, UsersRound, type LucideIcon } from "lucide-react";
import { StartTile, type StartTileTone } from "@/features/start-chat/components/start-tile";
import { useT } from "@/lib/i18n/client";
import type { AppMode } from "@/features/mode/mode";
import { cn } from "@/lib/utils";
import { pickRole, pickWelcomeRole } from "../actions";

/**
 * Rol tanlash (ega, 2026-11-20: savol bilan, rasmsiz; 2026-11-27: "kirish menyusida ham shunaqa bo'lsin" — bosh ekrandagi
 * ingichka tugmalar «Ishchi qidiryapman», «Ish qidiryapman»; shu oynada — oq tugma, rang faqat ostidan taralgan nurda). Bitta bosish — tanlanadi va
 * darhol davom etadi ("Davom etish" tugmasi yo'q). Har karta — forma tugmasi (name="mode"), shuning uchun JS'siz ham ishlaydi.
 * Tanlov — mavjud chooseMode (qurilma cookie'si + kirgan bo'lsa active_role). Rollar aralashmaydi.
 * `welcome` — xush kelibsiz ekranidan: mehmon darhol asosiy ekranga (kirish so'ralmaydi), kirgan, lekin profili yo'q
 * foydalanuvchi — oqim davom etadi (pickWelcomeRole).
 */
export function RolePicker({ initial, next, welcome = null }: { initial: AppMode | null; next: string; welcome?: { locale: string } | null }) {
  const { t } = useT();
  const [picked, setPicked] = useState<AppMode | null>(null);
  // ega (2026-11-27: "kirish menyusida ham shunaqa bo'lsin"): bosh ekrandagi kabi ingichka tugmalar va o'sha tartib —
  // «Ishchi qidiryapman», ostida «Ish qidiryapman»; rangsiz — rang ostidagi nurda (ko'k / yashil)
  const items = [
    { mode: "employer" as const, icon: UsersRound, tone: "navy" as const, title: t("easy.guided.start_workers") },
    { mode: "worker" as const, icon: BriefcaseBusiness, tone: "green" as const, title: t("easy.guided.start_jobs") },
  ];
  return (
    <form action={welcome ? pickWelcomeRole : pickRole} className="flex flex-col" data-role-form={welcome ? "welcome" : "role"}>
      {next ? <input type="hidden" name="next" value={next} /> : null}
      {welcome ? <input type="hidden" name="locale" value={welcome.locale} /> : null}
      <div role="group" aria-label={t("welcome.entry.role.title")} className="mt-6 grid gap-2.5">
        {items.map((it) => (
          <RoleTile key={it.mode} {...it} last={initial === it.mode} lastLabel={t("welcome.entry.role.last")} picked={picked === it.mode} onPick={() => setPicked(it.mode)} />
        ))}
      </div>
      <p className="mt-4 text-center text-sm text-muted-foreground">{t("welcome.entry.role.note")}</p>
    </form>
  );
}

function RoleTile({
  mode,
  icon,
  tone,
  title,
  last,
  lastLabel,
  picked,
  onPick,
}: {
  mode: AppMode;
  icon: LucideIcon;
  tone: StartTileTone;
  title: string;
  last: boolean;
  lastLabel: string;
  picked: boolean;
  onPick: () => void;
}) {
  const { pending } = useFormStatus();
  const busy = pending && picked;
  return (
    <StartTile
      type="submit"
      name="mode"
      value={mode}
      onClick={onPick}
      disabled={pending}
      icon={icon}
      label={title}
      tone={tone}
      look="glow"
      busy={busy}
      badge={last ? lastLabel : null}
      data-testid={`role-${mode}`}
      data-role-choice={mode}
      aria-busy={busy || undefined}
      className={cn(last && "ring-2 ring-primary ring-offset-2 ring-offset-background")}
    />
  );
}
