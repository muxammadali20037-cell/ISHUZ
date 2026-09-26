"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Trash2 } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { validateLogoFile, LOGO_MIME } from "../schema";
import { uploadCompanyLogo } from "../storage";
import { saveCompanyLogo } from "../actions";
import { errorMessageKey } from "../mappers";

const ACCEPT = Object.keys(LOGO_MIME).join(",");

/**
 * Logotip tanlash (kechiktirilgan rejim): faylni ota komponentga beradi, yuklash keyin bo'ladi
 * (onboarding'da kompaniya yaratilgach). Ko'rinish: kvadrat avatar + tugmalar.
 */
export function LogoPicker({
  currentUrl,
  fallback,
  file,
  onChange,
  disabled,
  busy,
  onRemoveCurrent,
}: {
  currentUrl: string | null;
  fallback: string;
  file: File | null;
  onChange: (file: File | null) => void;
  disabled?: boolean;
  busy?: boolean;
  /** Mavjud (serverdagi) logotipni o'chirish — faqat immediate rejimda */
  onRemoveCurrent?: () => void;
}) {
  const { t } = useT();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const src = preview ?? currentUrl;
  const hasAny = !!src;

  return (
    <div className="flex items-center gap-4">
      <Avatar src={src} fallback={fallback.slice(0, 2) || "?"} square size="xl" alt="" className="border border-border/70" />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" disabled={disabled} loading={busy} onClick={() => inputRef.current?.click()}>
            <ImagePlus className="size-4" /> {hasAny ? t("employer.form.logo_change") : t("employer.form.logo_upload")}
          </Button>
          {file ? (
            <Button type="button" variant="ghost" size="sm" disabled={disabled || busy} onClick={() => { onChange(null); setError(null); }}>
              <Trash2 className="size-4" /> {t("employer.form.logo_remove")}
            </Button>
          ) : currentUrl && onRemoveCurrent ? (
            <Button type="button" variant="ghost" size="sm" disabled={disabled || busy} onClick={onRemoveCurrent}>
              <Trash2 className="size-4" /> {t("employer.form.logo_remove")}
            </Button>
          ) : null}
        </div>
        <p className={error ? "text-sm text-destructive" : "text-xs text-muted-foreground"} role={error ? "alert" : undefined}>
          {error ? t(error) : t("employer.form.logo_hint")}
        </p>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="sr-only"
          tabIndex={-1}
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null;
            e.target.value = "";
            if (!f) return;
            const invalid = validateLogoFile(f);
            if (invalid) {
              setError(invalid);
              return;
            }
            setError(null);
            onChange(f);
          }}
        />
      </div>
    </div>
  );
}

/** Logotipni darhol yuklash (sozlamalar): storage → saveCompanyLogo → refresh */
export function LogoUploader({ companyId, logoUrl, fallback, disabled }: { companyId: string; logoUrl: string | null; fallback: string; disabled?: boolean }) {
  const { t } = useT();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [current, setCurrent] = useState(logoUrl);

  const upload = async (file: File) => {
    setBusy(true);
    try {
      const up = await uploadCompanyLogo(companyId, file);
      if (!up.ok) {
        toast.error(t(up.error));
        return;
      }
      const res = await saveCompanyLogo({ companyId, path: up.path });
      if (!res.ok) {
        toast.error(t(errorMessageKey(res.error)));
        return;
      }
      setCurrent(res.data?.logoUrl ?? null);
      toast.success(t("employer.form.logo_saved"));
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      const res = await saveCompanyLogo({ companyId, path: null });
      if (!res.ok) {
        toast.error(t(errorMessageKey(res.error)));
        return;
      }
      setCurrent(null);
      toast.success(t("employer.settings.saved"));
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return <LogoPicker currentUrl={current} fallback={fallback} file={null} onChange={(f) => f && void upload(f)} disabled={disabled} busy={busy} onRemoveCurrent={current ? () => void remove() : undefined} />;
}
