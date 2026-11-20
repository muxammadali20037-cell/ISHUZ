"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftRight, Loader2 } from "lucide-react";
import { setActiveRole } from "@/features/auth/actions";
import { callAction } from "@/lib/action-call";
import { toast } from "@/components/ui/toast";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import { announceRoleSwitch } from "@/components/shared/role-switch-splash";

/**
 * Rolni almashtirish qatori: ish izlovchi ↔ ish beruvchi — bir bosishda (rol ekrani "/start/rol" bilan bir xil amal: rejim
 * yoziladi va bosh sahifa o'sha rolda ochiladi). Ish beruvchi profili hali yo'q bo'lsa — bosh sahifaning o'zida "kompaniya
 * ma'lumotini to'ldiring" kartasi chiqadi (ruxsatlar serverda: requireEmployer, RLS). Telefondagi bosh sahifa menyusi va Profil.
 */
export function RoleSwitchRow({
  target,
  title,
  hint,
  tone = "danger",
  className,
  to = "/",
}: {
  /** almashtirgach ochiladigan sahifa (sukut — asosiy ekran; "E'lonlarim"da — shu sahifaning o'zi) */
  to?: string;
  target: "worker" | "employer";
  title: string;
  hint: string;
  /** "neutral" — rangsiz (bosh sahifa menyusining eng tagida, 2026-11-17), "danger" — qizil, "primary" — ko'k (Profil tepasida) */
  tone?: "danger" | "primary" | "neutral";
  className?: string;
}) {
  const router = useRouter();
  const { t } = useT();
  const [pending, start] = useTransition();
  const go = () =>
    start(async () => {
      const res = await callAction(() => setActiveRole(target));
      if (!res.ok) {
        const known = ["network", "offline", "timeout", "not_authenticated"].includes(res.error ?? "");
        toast.error(t(`common.errors.${known ? res.error : "generic"}`));
        return;
      }
      announceRoleSwitch(target);
      router.push(to);
      router.refresh();
    });
  return (
    <button
      type="button"
      onClick={go}
      disabled={pending}
      data-role-switch={target}
      className={cn(
        "press flex min-h-16 w-full items-center gap-3 rounded-2xl border px-4 py-2.5 text-left disabled:opacity-70",
        tone === "danger"
          ? "border-destructive/30 bg-destructive-soft/40 text-destructive hover:bg-destructive-soft/70"
          : tone === "neutral"
            ? "border-border/70 bg-card text-foreground shadow-sm hover:bg-secondary/60"
            : "border-primary/30 bg-primary-soft/60 text-primary-ink hover:border-primary/60",
        className,
      )}
    >
      <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", tone === "danger" ? "bg-destructive/10" : tone === "neutral" ? "bg-secondary" : "bg-primary text-primary-foreground")} aria-hidden>
        {pending ? <Loader2 className="size-5 animate-spin" /> : <ArrowLeftRight className="size-5" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-base font-bold leading-tight">{title}</span>
        <span className={cn("mt-0.5 block text-sm leading-snug", tone === "danger" ? "text-destructive" : "text-muted-foreground")}>{hint}</span>
      </span>
    </button>
  );
}
