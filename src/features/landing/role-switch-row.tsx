"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftRight, Loader2 } from "lucide-react";
import { setActiveRole } from "@/features/auth/actions";
import { callAction } from "@/lib/action-call";
import { toast } from "@/components/ui/toast";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

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
}: {
  target: "worker" | "employer";
  title: string;
  hint: string;
  /** "danger" — qizil (bosh sahifa menyusining eng tagida), "primary" — ko'k (Profil tepasida) */
  tone?: "danger" | "primary";
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
      router.push("/");
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
          : "border-primary/30 bg-primary-soft/60 text-primary-ink hover:border-primary/60",
        className,
      )}
    >
      <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", tone === "danger" ? "bg-destructive/10" : "bg-primary text-primary-foreground")} aria-hidden>
        {pending ? <Loader2 className="size-5 animate-spin" /> : <ArrowLeftRight className="size-5" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-base font-bold leading-tight">{title}</span>
        <span className={cn("mt-0.5 block text-sm leading-snug", tone === "danger" ? "text-destructive" : "text-muted-foreground")}>{hint}</span>
      </span>
    </button>
  );
}
