"use client";

import { useId, useState, useTransition } from "react";
import Link from "next/link";
import { Bookmark, MessageCircle, Send } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, Sheet } from "@/components/ui/dialog";
import { Input, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { toast } from "@/components/ui/toast";
import { ReportDialog } from "@/features/reports/report-dialog";
import { saveWorker, sendOffer, unsaveWorker } from "../actions";
import type { SavedEntry } from "../types";
import { MoneyInput } from "./money-input";
import { errorText } from "./error-text";
import { callAction } from "@/lib/action-call";

interface Props {
  workerId: string;
  workerName: string;
  profileId: string;
  chatHref: string | null;
  saved: SavedEntry | null;
  folders: string[];
}

/**
 * Nomzod amallari: "Taklif yuborish" (Sheet), "Saqlash" (Sheet: papka + eslatma), "Yozish", "Shikoyat".
 * Mobil: pastki yopishqoq panel; desktop: yon karta. Ikkalasi bitta holatni ulashadi.
 */
export function CandidateActions(props: Props) {
  const { t } = useT();
  const [offerOpen, setOfferOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saved, setSaved] = useState<SavedEntry | null>(props.saved);
  const [chatHref, setChatHref] = useState(props.chatHref);
  const [unsaving, startUnsave] = useTransition();

  const isSaved = saved !== null;
  const toggleSave = () => {
    if (!isSaved) {
      setSaveOpen(true);
      return;
    }
    const prev = saved;
    setSaved(null);
    startUnsave(async () => {
      const res = await callAction(() => unsaveWorker({ workerId: props.workerId }));
      if (!res.ok) {
        setSaved(prev);
        toast.error(errorText(t, res.error));
        return;
      }
      toast.success(t("workers.save.removed"));
    });
  };

  const writeButton = (compact: boolean) =>
    chatHref ? (
      <Button asChild variant="outline" size={compact ? "icon" : "default"} fullWidth={!compact} aria-label={t("workers.actions.write")}>
        <Link href={chatHref}>
          <MessageCircle className="size-5" />
          {!compact ? t("workers.actions.open_chat") : null}
        </Link>
      </Button>
    ) : (
      <Button type="button" variant="outline" size={compact ? "icon" : "default"} fullWidth={!compact} disabled title={t("workers.actions.write_hint")} aria-label={t("workers.actions.write")}>
        <MessageCircle className="size-5" />
        {!compact ? t("workers.actions.write") : null}
      </Button>
    );

  const saveButton = (compact: boolean) => (
    <Button
      type="button"
      variant={isSaved ? "soft" : "outline"}
      size={compact ? "icon" : "default"}
      fullWidth={!compact}
      onClick={toggleSave}
      disabled={unsaving}
      aria-pressed={isSaved}
      aria-label={isSaved ? t("workers.actions.unsave") : t("workers.actions.save")}
    >
      <Bookmark className={cn("size-5", isSaved && "fill-primary text-primary-ink")} />
      {!compact ? (isSaved ? t("workers.actions.saved") : t("workers.actions.save")) : null}
    </Button>
  );

  const offerButton = (
    <Button type="button" fullWidth onClick={() => setOfferOpen(true)}>
      <Send className="size-4" />
      {t("workers.actions.offer")}
    </Button>
  );

  return (
    <>
      {/* Desktop: yon karta */}
      <div className="hidden rounded-2xl border border-border/70 bg-card p-4 md:block">
        <div className="space-y-2">
          {offerButton}
          {saveButton(false)}
          {writeButton(false)}
          {!chatHref ? <p className="text-center text-xs text-muted-foreground">{t("workers.actions.write_hint")}</p> : null}
        </div>
        <div className="mt-3 border-t border-border pt-2">
          <ReportDialog targetType="profile" targetId={props.profileId} className="w-full text-muted-foreground" />
        </div>
      </div>

      {/* Mobil: pastki panel (tab bar ustida) */}
      <div
        className="fixed inset-x-0 z-30 border-t border-border bg-card px-4 py-2.5 md:hidden"
        style={{ bottom: "calc(var(--tabbar-height) + var(--safe-bottom))" }}
      >
        <div className="mx-auto flex max-w-6xl items-center gap-2">
          {saveButton(true)}
          {writeButton(true)}
          <div className="flex-1">{offerButton}</div>
        </div>
      </div>
      <div className="flex justify-end md:hidden">
        <ReportDialog targetType="profile" targetId={props.profileId} />
      </div>

      <OfferSheet
        open={offerOpen}
        onOpenChange={setOfferOpen}
        workerId={props.workerId}
        workerName={props.workerName}
        onSent={(offerId) => setChatHref((h) => h ?? `/messages/new?offer_id=${offerId}`)}
      />
      <SaveSheet open={saveOpen} onOpenChange={setSaveOpen} workerId={props.workerId} folders={props.folders} onSaved={(entry) => setSaved(entry)} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Taklif yuborish
// ---------------------------------------------------------------------------

function OfferSheet({
  open,
  onOpenChange,
  workerId,
  workerName,
  onSent,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  workerId: string;
  workerName: string;
  onSent: (offerId: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? <OfferSheetBody workerId={workerId} workerName={workerName} onSent={onSent} close={() => onOpenChange(false)} /> : null}
    </Dialog>
  );
}

/**
 * Taklif — har doim erkin shaklda (ega, 2026-11-19: "o'z joylagan e'loni bo'yicha yuboryapti — vakansiya tanlamasin,
 * «Qanday vakansiya taklif qilmoqchisiz?» deb chiqsin"): ish beruvchi lavozimni o'zi yozadi, maosh — ixtiyoriy.
 */
function OfferSheetBody({
  workerId,
  workerName,
  onSent,
  close,
}: {
  workerId: string;
  workerName: string;
  onSent: (offerId: string) => void;
  close: () => void;
}) {
  const { t } = useT();
  const ids = useId();
  const [title, setTitle] = useState("");
  const [salaryFrom, setSalaryFrom] = useState<number | null>(null);
  const [salaryTo, setSalaryTo] = useState<number | null>(null);
  const [message, setMessage] = useState(t("workers.offer.template", { name: workerName }));
  const [errors, setErrors] = useState<{ title?: string; salary?: string }>({});
  const [pending, startTransition] = useTransition();

  const submit = () => {
    const next: typeof errors = {};
    if (title.trim().length < 2) next.title = t("workers.errors.title_required");
    if (salaryFrom !== null && salaryTo !== null && salaryTo < salaryFrom) next.salary = t("workers.errors.salary_range");
    setErrors(next);
    if (Object.keys(next).length) return;
    startTransition(async () => {
      const res = await callAction(() => sendOffer({
        workerId,
        vacancyId: null,
        title: title.trim(),
        message: message.trim() || undefined,
        salaryFrom,
        salaryTo,
      }));
      if (!res.ok) {
        toast.error(errorText(t, res.error));
        return;
      }
      toast.success(t("workers.offer.sent"), t("workers.offer.sent_desc"));
      onSent(res.data?.id ?? "");
      close();
    });
  };

  return (
    <Sheet
      title={t("workers.offer.title")}
      description={t("workers.offer.description")}
      footer={
        <Button type="button" fullWidth loading={pending} onClick={submit}>
          {t("workers.offer.send")}
        </Button>
      }
    >
      <div className="space-y-4">
        <Field label={t("workers.offer.what_vacancy")} htmlFor={`${ids}-title`} required error={errors.title}>
          <Input
            id={`${ids}-title`}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("workers.offer.offer_title_placeholder")}
            maxLength={120}
            invalid={!!errors.title}
            data-offer-title
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("workers.offer.salary_from")} htmlFor={`${ids}-from`}>
            <MoneyInput id={`${ids}-from`} value={salaryFrom} onChange={setSalaryFrom} placeholder="0" suffix={t("workers.offer.salary_currency")} />
          </Field>
          <Field label={t("workers.offer.salary_to")} htmlFor={`${ids}-to`} error={errors.salary}>
            <MoneyInput id={`${ids}-to`} value={salaryTo} onChange={setSalaryTo} placeholder="0" suffix={t("workers.offer.salary_currency")} invalid={!!errors.salary} />
          </Field>
        </div>
        <Field label={t("workers.offer.message")} htmlFor={`${ids}-msg`}>
          <Textarea id={`${ids}-msg`} value={message} onChange={(e) => setMessage(e.target.value)} placeholder={t("workers.offer.message_placeholder")} maxLength={2000} className="min-h-[110px]" />
        </Field>
      </div>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Saqlash (papka + eslatma)
// ---------------------------------------------------------------------------

function SaveSheet({ open, onOpenChange, workerId, folders, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; workerId: string; folders: string[]; onSaved: (entry: SavedEntry) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? <SaveSheetBody workerId={workerId} folders={folders} onSaved={onSaved} close={() => onOpenChange(false)} /> : null}
    </Dialog>
  );
}

function SaveSheetBody({ workerId, folders, onSaved, close }: { workerId: string; folders: string[]; onSaved: (entry: SavedEntry) => void; close: () => void }) {
  const { t } = useT();
  const ids = useId();
  const [folder, setFolder] = useState("");
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();

  const submit = () => {
    startTransition(async () => {
      const res = await callAction(() => saveWorker({ workerId, folder: folder.trim() || null, note: note.trim() || null }));
      if (!res.ok) {
        toast.error(errorText(t, res.error));
        return;
      }
      onSaved({ folder: folder.trim() || null, note: note.trim() || null });
      toast.success(t("workers.save.saved"));
      close();
    });
  };

  return (
    <Sheet
      title={t("workers.save.title")}
      description={t("workers.save.description")}
      footer={
        <Button type="button" fullWidth loading={pending} onClick={submit}>
          {t("workers.save.submit")}
        </Button>
      }
    >
      <div className="space-y-4">
        <Field label={t("workers.save.folder")} htmlFor={`${ids}-folder`} hint={t("common.labels.optional")}>
          <Input id={`${ids}-folder`} list={`${ids}-folders`} value={folder} onChange={(e) => setFolder(e.target.value)} placeholder={t("workers.save.folder_placeholder")} maxLength={60} />
          <datalist id={`${ids}-folders`}>
            {folders.map((f) => (
              <option key={f} value={f} />
            ))}
          </datalist>
          {folders.length ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {folders.map((f) => (
                <button key={f} type="button" onClick={() => setFolder(f)} className={cn("h-8 rounded-full border px-3 text-xs font-medium", folder === f ? "border-primary bg-primary-soft text-primary-ink" : "border-border bg-card hover:bg-secondary")}>
                  {f}
                </button>
              ))}
            </div>
          ) : null}
        </Field>
        <Field label={t("workers.save.note")} htmlFor={`${ids}-note`} hint={t("common.labels.optional")}>
          <Textarea id={`${ids}-note`} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("workers.save.note_placeholder")} maxLength={1000} className="min-h-[90px]" />
        </Field>
      </div>
    </Sheet>
  );
}
