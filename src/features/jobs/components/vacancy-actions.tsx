"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bookmark, CheckCircle2, Send, Settings2, Share2 } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import type { Enums } from "@/types/database.types";
import { Button } from "@/components/ui/button";
import { Dialog, Sheet } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { toast } from "@/components/ui/toast";
import { applyToVacancy } from "../actions";
import { errorMessage } from "../i18n-helpers";
import { APPLY_MESSAGE_MAX } from "../schema";
import type { VacancyViewerState } from "../types";
import { useSaveVacancy } from "./use-save-vacancy";

export interface VacancyActionsProps {
  vacancy: { id: string; slug: string; title: string; companyName: string | null; status: Enums<"vacancy_status"> };
  viewer: Pick<VacancyViewerState, "kind" | "isSaved" | "application">;
}

/**
 * Saqlash · Ulashish · Ariza yuborish. Mobil: pastki yopishqoq panel; desktop (lg): yon karta.
 * Kirmagan → /auth?next=; worker profili yo'q → /onboarding/worker; boshqaruvchi → "Boshqarish".
 */
export function VacancyActions({ vacancy, viewer }: VacancyActionsProps) {
  const { t } = useT();
  const router = useRouter();
  const { toggle, pendingId, dialog } = useSaveVacancy();
  const [saved, setSaved] = useState(viewer.isSaved);
  const [application, setApplication] = useState<{ id: string | null } | null>(viewer.application ? { id: viewer.application.id } : null);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState(() => t("jobs.apply.default_message", { title: vacancy.title }));
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState<string | null>(null);

  const detailPath = `/jobs/${vacancy.slug}`;
  const isActive = vacancy.status === "active";

  const onSave = async () => {
    const next = !saved;
    setSaved(next);
    const ok = await toggle(vacancy.id, next);
    if (!ok) setSaved(!next);
  };

  const onShare = async () => {
    const url = `${window.location.origin}${detailPath}`;
    const text = t("jobs.detail.share_text", { title: vacancy.title, company: vacancy.companyName ?? "ISH.UZ" });
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: vacancy.title, text, url });
        return;
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t("jobs.detail.link_copied"));
    } catch {
      toast.error(t("common.errors.generic"));
    }
  };

  const onApplyClick = () => {
    if (viewer.kind === "guest") {
      router.push(`/auth?next=${encodeURIComponent(detailPath)}`);
      return;
    }
    if (viewer.kind === "no_worker") {
      router.push("/onboarding/worker");
      return;
    }
    setDone(null);
    setOpen(true);
  };

  const submit = () => {
    startTransition(async () => {
      const res = await applyToVacancy({ vacancyId: vacancy.id, message: message.trim() || undefined });
      if (res.ok) {
        const id = res.data?.id ?? null;
        setApplication({ id });
        setDone(id);
        return;
      }
      switch (res.error) {
        case "already_applied":
          setApplication({ id: null });
          setOpen(false);
          toast.info(t("jobs.apply.errors.already_applied"));
          return;
        case "not_authenticated":
          router.push(`/auth?next=${encodeURIComponent(detailPath)}`);
          return;
        case "worker_profile_required":
          router.push("/onboarding/worker");
          return;
        default:
          toast.error(errorMessage(t, res.error, "jobs.apply.errors"));
      }
    });
  };

  const applicationHref = application?.id ? `/applications/${application.id}` : "/applications";

  const primary = (props: { fullWidth?: boolean; size?: "default" | "lg" }) => {
    if (viewer.kind === "manager") {
      return (
        <Button asChild variant="outline" fullWidth={props.fullWidth} size={props.size}>
          <Link href={`/employer/vacancies/${vacancy.id}`}>
            <Settings2 className="size-4" /> {t("jobs.detail.manage")}
          </Link>
        </Button>
      );
    }
    if (application) {
      return (
        <Button asChild variant="soft" fullWidth={props.fullWidth} size={props.size}>
          <Link href={applicationHref}>
            <CheckCircle2 className="size-4" /> {t("jobs.detail.applied")}
          </Link>
        </Button>
      );
    }
    return (
      <Button type="button" onClick={onApplyClick} disabled={!isActive} fullWidth={props.fullWidth} size={props.size}>
        <Send className="size-4" /> {t("jobs.detail.apply")}
      </Button>
    );
  };

  const saveLabel = saved ? t("jobs.detail.saved") : t("jobs.detail.save");
  const saveIcon = <Bookmark className={cn("size-5", saved && "fill-primary text-primary")} />;

  return (
    <>
      {/* Desktop (lg+): yon karta */}
      <div className="hidden space-y-3 rounded-2xl border border-border/70 bg-card p-4 shadow-sm lg:block">
        {primary({ fullWidth: true, size: "lg" })}
        {application ? <p className="text-center text-xs text-muted-foreground">{t("jobs.apply.success_desc")}</p> : null}
        {!isActive && viewer.kind !== "manager" ? <p className="text-center text-xs text-warning">{t("jobs.detail.status_inactive")}</p> : null}
        <div className="grid grid-cols-2 gap-2">
          <Button type="button" variant="outline" onClick={onSave} loading={pendingId === vacancy.id} aria-pressed={saved}>
            {saveIcon} {saveLabel}
          </Button>
          <Button type="button" variant="outline" onClick={onShare}>
            <Share2 className="size-5" /> {t("jobs.detail.share")}
          </Button>
        </div>
      </div>

      {/* Mobil / planshet: pastki yopishqoq panel (bottom nav ustida) */}
      <div
        className="fixed inset-x-0 z-30 border-t border-border/70 bg-card/95 px-4 py-2.5 backdrop-blur supports-[backdrop-filter]:bg-card/85 lg:hidden"
        style={{ bottom: "calc(var(--tabbar-height) + env(safe-area-inset-bottom, 0px))" }}
      >
        <div className="container-app flex items-center gap-2 px-0 sm:px-0">
          <Button type="button" variant="outline" size="icon" onClick={onSave} loading={pendingId === vacancy.id} aria-label={saveLabel} aria-pressed={saved}>
            {saveIcon}
          </Button>
          <Button type="button" variant="outline" size="icon" onClick={onShare} aria-label={t("jobs.detail.share")}>
            <Share2 className="size-5" />
          </Button>
          <div className="flex-1">{primary({ fullWidth: true })}</div>
        </div>
      </div>

      {dialog}

      <Dialog open={open} onOpenChange={(o) => !pending && setOpen(o)}>
        {done ? (
          <Sheet title={t("jobs.apply.success_title")}>
            <div className="flex flex-col items-center py-4 text-center">
              <span className="flex size-16 items-center justify-center rounded-full bg-success-soft text-success">
                <CheckCircle2 className="size-8" />
              </span>
              <p className="mt-4 text-lg font-semibold">{t("jobs.apply.success_title")}</p>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">{t("jobs.apply.success_desc")}</p>
              <Button asChild className="mt-6" fullWidth>
                <Link href={`/applications/${done}`}>{t("jobs.apply.success_action")}</Link>
              </Button>
              <Button type="button" variant="ghost" className="mt-2" fullWidth onClick={() => setOpen(false)}>
                {t("common.actions.close")}
              </Button>
            </div>
          </Sheet>
        ) : (
          <Sheet
            title={t("jobs.apply.title")}
            description={t("jobs.apply.description")}
            footer={
              <Button type="button" fullWidth size="lg" onClick={submit} loading={pending}>
                <Send className="size-4" /> {t("jobs.apply.submit")}
              </Button>
            }
          >
            <Field label={t("jobs.apply.message_label")} hint={t("jobs.apply.message_hint")} htmlFor="apply-message" description={t("jobs.apply.chars", { count: message.length, max: APPLY_MESSAGE_MAX })}>
              <Textarea
                id="apply-message"
                value={message}
                onChange={(e) => setMessage(e.target.value.slice(0, APPLY_MESSAGE_MAX))}
                maxLength={APPLY_MESSAGE_MAX}
                placeholder={t("jobs.apply.message_placeholder")}
                className="min-h-[140px]"
                disabled={pending}
              />
            </Field>
          </Sheet>
        )}
      </Dialog>
    </>
  );
}
