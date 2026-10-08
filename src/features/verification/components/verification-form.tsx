"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/client";
import { DocumentUpload, type UploadedDoc } from "@/features/employer/components/settings/document-upload";
import { submitEmployerVerification } from "../actions";

/** Tasdiqlash: tashkilot/YATT uchun STIR yoki JShShIR; jismoniy shaxsdan yuridik hujjat talab qilinmaydi */
export function VerificationForm({ userId, needsId, initialId }: { userId: string; needsId: boolean; initialId: string | null }) {
  const { t } = useT();
  const router = useRouter();
  const [idn, setIdn] = useState(initialId ?? "");
  const [note, setNote] = useState("");
  const [docs, setDocs] = useState<UploadedDoc[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const submit = () =>
    start(async () => {
      setError(null);
      const digits = idn.replace(/\D/g, "");
      if (needsId && digits.length !== 9 && digits.length !== 14) {
        setError(t("easy.verification.id_required"));
        return;
      }
      const res = await submitEmployerVerification({ identityNumber: digits || undefined, note, documentPaths: docs.map((d) => d.path) });
      if (!res.ok) {
        const key = `easy.verification.errors.${res.error}`;
        const msg = t(key);
        setError(msg === key ? t("easy.errors.generic") : msg);
        return;
      }
      router.refresh();
    });

  return (
    <div className="space-y-4 rounded-3xl border border-border bg-card p-5">
      <label className="block space-y-2">
        <span className="font-bold">{t(needsId ? "easy.verification.id_label" : "easy.verification.id_label_optional")}</span>
        <input
          inputMode="numeric"
          value={idn}
          onChange={(e) => setIdn(e.target.value.replace(/[^\d ]/g, "").slice(0, 17))}
          className="block h-14 w-full rounded-2xl border-2 border-input bg-background px-4 text-lg tracking-wider"
          placeholder="123456789"
          aria-invalid={!!error}
        />
        <span className="block text-sm text-muted-foreground">{t("easy.verification.id_hint")}</span>
      </label>
      <label className="block space-y-2">
        <span className="font-bold">{t("easy.verification.note_label")}</span>
        <textarea value={note} onChange={(e) => setNote(e.target.value.slice(0, 1000))} rows={3} className="block w-full rounded-2xl border-2 border-input bg-background p-4 text-lg" placeholder={t("easy.verification.note_placeholder")} />
      </label>
      <div className="space-y-2">
        <p className="font-bold">{t("easy.verification.docs_label")}</p>
        <p className="text-sm text-muted-foreground">{t("easy.verification.docs_hint")}</p>
        <DocumentUpload userId={userId} value={docs} onChange={setDocs} disabled={pending} />
      </div>
      {error ? <p className="font-semibold text-destructive" role="alert">{error}</p> : null}
      <Button size="xl" className="h-14 w-full text-lg" disabled={pending} onClick={submit}>
        {pending ? t("easy.wizard.saving") : t("easy.verification.submit")}
      </Button>
    </div>
  );
}
