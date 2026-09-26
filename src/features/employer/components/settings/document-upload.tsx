"use client";

import { useRef, useState } from "react";
import { FileText, Paperclip, X } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { DOC_MAX_COUNT, DOC_MIME } from "../../schema";
import { removeVerificationDocument, uploadVerificationDocument } from "../../storage";

const ACCEPT = Object.keys(DOC_MIME).join(",");

export interface UploadedDoc {
  path: string;
  name: string;
}

/** Tasdiqlash hujjatlari: documents/<userId>/<uuid>.<ext> ga yuklash (5 tagacha) */
export function DocumentUpload({ userId, value, onChange, disabled }: { userId: string; value: UploadedDoc[]; onChange: (docs: UploadedDoc[]) => void; disabled?: boolean }) {
  const { t } = useT();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const full = value.length >= DOC_MAX_COUNT;

  const addFiles = async (files: File[]) => {
    if (!files.length) return;
    if (value.length + files.length > DOC_MAX_COUNT) {
      toast.error(t("employer.verification.errors.doc_limit"));
      files = files.slice(0, Math.max(0, DOC_MAX_COUNT - value.length));
      if (!files.length) return;
    }
    setBusy(true);
    try {
      const next = [...value];
      for (const file of files) {
        const res = await uploadVerificationDocument(userId, file);
        if (!res.ok) {
          toast.error(t(res.error), file.name);
          continue;
        }
        next.push({ path: res.path, name: file.name });
      }
      onChange(next);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (doc: UploadedDoc) => {
    onChange(value.filter((d) => d.path !== doc.path));
    await removeVerificationDocument(doc.path);
  };

  return (
    <div className="space-y-2">
      {value.length ? (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {value.map((d) => (
            <li key={d.path} className="flex items-center gap-2 px-3 py-2 text-sm">
              <FileText className="size-4 shrink-0 text-primary" />
              <span className="min-w-0 flex-1 truncate">{d.name}</span>
              <button type="button" onClick={() => void remove(d)} disabled={disabled || busy} className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-50" aria-label={t("common.actions.delete")}>
                <X className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <Button type="button" variant="outline" size="sm" disabled={disabled || full} loading={busy} onClick={() => inputRef.current?.click()}>
        <Paperclip className="size-4" /> {t("employer.verification.add_document")}
      </Button>
      <p className="text-xs text-muted-foreground">{t("employer.verification.documents_hint")}</p>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          void addFiles(files);
        }}
      />
    </div>
  );
}
