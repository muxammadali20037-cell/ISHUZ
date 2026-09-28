"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Lock, Trash2 } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { formatRelative } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { addApplicationNote, deleteApplicationNote } from "../actions";
import { actionErrorText } from "../errors";
import type { ApplicationNote } from "../types";

/** Ish beruvchining shaxsiy izohlari (nomzod ko'rmaydi) */
export function ApplicationNotes({ applicationId, vacancyId, notes, myId, canWrite }: { applicationId: string; vacancyId: string; notes: ApplicationNote[]; myId: string; canWrite: boolean }) {
  const { t, locale } = useT();
  const router = useRouter();
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();

  const add = () => {
    const text = body.trim();
    if (!text) return;
    startTransition(async () => {
      const res = await addApplicationNote({ applicationId, vacancyId, body: text });
      if (!res.ok) {
        toast.error(actionErrorText(t, res.error));
        return;
      }
      setBody("");
      toast.success(t("applications.notes.saved"));
      router.refresh();
    });
  };

  const remove = (id: string) =>
    startTransition(async () => {
      const res = await deleteApplicationNote({ id, applicationId, vacancyId });
      if (!res.ok) toast.error(actionErrorText(t, res.error));
      router.refresh();
    });

  return (
    <section className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <Lock className="size-4 text-muted-foreground" /> {t("applications.notes.title")}
      </p>
      <p className="mb-3 text-xs text-muted-foreground">{t("applications.notes.hint")}</p>
      {canWrite ? (
        <div className="mb-3 space-y-2">
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={1000} placeholder={t("applications.notes.placeholder")} className="min-h-[72px]" aria-label={t("applications.notes.add")} />
          <Button type="button" size="sm" onClick={add} loading={pending} disabled={!body.trim()}>
            {t("applications.notes.add")}
          </Button>
        </div>
      ) : null}
      {notes.length ? (
        <ul className="space-y-2">
          {notes.map((n) => (
            <li key={n.id} className="rounded-xl bg-secondary/60 px-3 py-2">
              <p className="whitespace-pre-line text-sm">{n.body}</p>
              <div className="mt-1 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>{[n.author_name, formatRelative(n.created_at, locale)].filter(Boolean).join(" · ")}</span>
                {n.author_id === myId ? (
                  <button type="button" onClick={() => remove(n.id)} disabled={pending} className="inline-flex items-center gap-1 hover:text-destructive" aria-label={t("applications.notes.delete")}>
                    <Trash2 className="size-3.5" />
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">{t("applications.notes.empty")}</p>
      )}
    </section>
  );
}
