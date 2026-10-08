"use client";

import { useRef, useState } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { vacancyPhotoUrl } from "../photo";
import { useT } from "@/lib/i18n/client";

const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const MAX = 5 * 1024 * 1024;

/**
 * Haqiqiy ish joyi surati (ixtiyoriy). Faqat egasining papkasiga (vacancy-photos/<uid>/...) yuklanadi;
 * e'lon bilan birga moderatsiyadan o'tadi (rasm va undagi yozuv). AI kasb tasviri bilan adashtirilmaydi.
 */
export function PhotoUpload({ userId, value, onChange }: { userId: string; value: string | null; onChange: (path: string | null) => void }) {
  const { t } = useT();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    const ext = TYPES[file.type];
    if (!ext) return setError(t("easy.photo.bad_type"));
    if (file.size > MAX) return setError(t("easy.photo.too_large"));
    setBusy(true);
    const path = `${userId}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await createClient().storage.from("vacancy-photos").upload(path, file, { contentType: file.type, cacheControl: "31536000", upsert: false });
    setBusy(false);
    if (upErr) return setError(t("easy.photo.failed"));
    onChange(path);
  };

  const url = vacancyPhotoUrl(value);
  return (
    <div className="space-y-2">
      <p className="text-lg font-semibold">{t("easy.photo.title")}</p>
      <p className="text-base text-muted-foreground">{t("easy.photo.hint")}</p>
      {url ? (
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={t("easy.photo.alt")} className="aspect-[4/3] w-40 rounded-2xl object-cover" />
          <Button type="button" variant="outline" className="min-h-12 text-base" onClick={() => onChange(null)}>
            <Trash2 className="size-5" aria-hidden /> {t("easy.photo.remove")}
          </Button>
        </div>
      ) : (
        <Button type="button" variant="outline" className="min-h-12 text-base" disabled={busy} onClick={() => input.current?.click()}>
          <ImagePlus className="size-5" aria-hidden /> {busy ? t("easy.wizard.saving") : t("easy.photo.add")}
        </Button>
      )}
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => void pick(e.target.files?.[0])} />
      {error ? <p className="text-base font-semibold text-destructive" role="alert">{error}</p> : null}
    </div>
  );
}
