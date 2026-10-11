"use client";

import { useRef, useState } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { vacancyPhotoUrl } from "../photo";
import { useT } from "@/lib/i18n/client";
import { verifyVacancyPhoto } from "../actions";

const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const MAX = 5 * 1024 * 1024;

/**
 * Haqiqiy ish joyi surati (ixtiyoriy). Xom fayl egasining papkasiga — yopiq karantinga (vacancy-uploads, 0058; eski bazada
 * vacancy-photos) — yuklanadi, so'ng server uni tekshirib, metama'lumotsiz qayta kodlaydi; qoralamaga faqat tekshirilgan
 * yo'l yoziladi. E'lon bilan birga moderatsiyadan o'tadi. AI kasb tasviri bilan adashtirilmaydi.
 */
export function PhotoUpload({ userId, value, onChange, quarantine }: { userId: string; value: string | null; onChange: (path: string | null) => void; quarantine: boolean }) {
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
    const bucket = quarantine ? "vacancy-uploads" : "vacancy-photos";
    const { error: upErr } = await createClient().storage.from(bucket).upload(path, file, { contentType: file.type, upsert: false });
    if (upErr) {
      setBusy(false);
      return setError(t("easy.photo.failed"));
    }
    const res = await verifyVacancyPhoto({ path }).catch(() => null);
    setBusy(false);
    if (!res?.ok || !res.data) return setError(t(res && !res.ok && res.error === "photo_invalid" ? "easy.photo.invalid" : "easy.photo.failed"));
    onChange(res.data.path);
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
        <Button type="button" variant="outline" className="min-h-12 text-base" disabled={busy} aria-busy={busy} onClick={() => input.current?.click()}>
          <ImagePlus className="size-5" aria-hidden /> {busy ? t("easy.photo.checking") : t("easy.photo.add")}
        </Button>
      )}
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={(e) => {
          void pick(e.target.files?.[0]);
          e.target.value = ""; // o'sha faylni qayta tanlash ham ishlasin
        }}
      />
      {error ? <p className="text-base font-semibold text-destructive" role="alert">{error}</p> : null}
    </div>
  );
}
