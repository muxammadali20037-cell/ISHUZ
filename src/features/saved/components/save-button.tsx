"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Bookmark, BookmarkCheck } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { callAction } from "@/lib/action-call";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { toggleSaved } from "../actions";

/**
 * Kartadagi "Saqlash" belgisi: bosilsa — "Saqlanganlar"ga qo'shiladi (pastki menyu). Kirmagan foydalanuvchi — kirish
 * sahifasiga (keyin shu joyga qaytadi). `refresh` — "Saqlanganlar" sahifasida olib tashlangan karta ro'yxatdan yo'qolsin.
 */
export function SaveButton({ kind, id, initial, label, refresh = false, className }: { kind: "vacancy" | "worker"; id: string; initial: boolean; label: string; refresh?: boolean; className?: string }) {
  const { t } = useT();
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const [saved, setSaved] = useState(initial);
  const [pending, start] = useTransition();

  const toggle = () =>
    start(async () => {
      const next = !saved;
      setSaved(next);
      const res = await callAction(() => toggleSaved({ kind, id, save: next }));
      if (res.ok) {
        toast.success(next ? t("easy.saved.added") : t("easy.saved.removed"));
        if (refresh) router.refresh();
        return;
      }
      setSaved(!next);
      if (res.error === "not_authenticated") {
        const q = search.toString();
        router.push(`/auth?next=${encodeURIComponent(`${pathname}${q ? `?${q}` : ""}`)}`);
        return;
      }
      toast.error(res.error === "saved_limit" ? t("easy.saved.limit") : res.error === "blocked" ? t("common.errors.blocked") : t("easy.saved.failed"));
    });

  const Icon = saved ? BookmarkCheck : Bookmark;
  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-pressed={saved}
      aria-label={`${saved ? t("easy.saved.saved") : t("easy.saved.save")}: ${label}`}
      title={saved ? t("easy.saved.saved") : t("easy.saved.save")}
      data-track="save_toggle"
      data-track-to={kind}
      className={cn(
        "press flex size-11 shrink-0 items-center justify-center rounded-xl border transition-colors",
        saved ? "border-primary bg-primary-soft text-primary" : "border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-primary",
        className,
      )}
    >
      <Icon className={cn("size-5", saved && "fill-primary/20")} aria-hidden />
    </button>
  );
}
