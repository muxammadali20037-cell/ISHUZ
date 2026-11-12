"use client";

import { useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { createClient } from "@/lib/supabase/client";
import { callAction } from "@/lib/action-call";
import { vacancyPhotoUrl } from "@/features/post/photo";
import { verifyMasterPhoto } from "../actions";
import { MASTER_PHOTOS_MAX } from "../types";

const TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const MAX = 5 * 1024 * 1024;

/**
 * Ish namunalari (4 tagacha): xom fayl yopiq karantinga (vacancy-uploads) yuklanadi, server tekshirib EXIF'siz WebP qiladi
 * (vakansiya surati bilan bir xil quvur) — e'longa faqat tekshirilgan yo'l yoziladi (bazada ham tekshiriladi).
 */
export function PhotosUpload({
  userId,
  value,
  onChange,
}: {
  userId: string;
  value: string[];
  onChange: (paths: string[]) => void;
}) {
  const { t } = useT();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = async (files: FileList | null) => {
    if (!files?.length) return;
    setError(null);
    const room = MASTER_PHOTOS_MAX - value.length;
    const list = Array.from(files).slice(0, room);
    setBusy(true);
    const added: string[] = [];
    for (const file of list) {
      const ext = TYPES[file.type];
      if (!ext) {
        setError(t("easy.photo.bad_type"));
        continue;
      }
      if (file.size > MAX) {
        setError(t("easy.photo.too_large"));
        continue;
      }
      const path = `${userId}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await createClient()
        .storage.from("vacancy-uploads")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) {
        setError(t("easy.photo.failed"));
        continue;
      }
      const res = await callAction(() => verifyMasterPhoto({ path })).catch(
        () => null,
      );
      if (!res?.ok || !res.data) {
        setError(
          t(
            res && !res.ok && res.error === "photo_invalid"
              ? "easy.photo.invalid"
              : "easy.photo.failed",
          ),
        );
        continue;
      }
      added.push(res.data.path);
    }
    setBusy(false);
    if (added.length)
      onChange([...value, ...added].slice(0, MASTER_PHOTOS_MAX));
  };

  return (
    <div className="space-y-2" data-masters-photos-upload>
      <ul className="flex flex-wrap gap-2">
        {value.map((p, i) => {
          const url = vacancyPhotoUrl(p);
          return (
            <li key={p} className="relative">
              {url ? (
                // eslint-disable-next-line @next/next/no-img-element -- tekshirilgan public URL
                <img src={url} alt="" className="aspect-[4/3] w-32 rounded-xl object-cover" />
              ) : null}
              <button
                type="button"
                onClick={() => onChange(value.filter((x) => x !== p))}
                aria-label={`${t("easy.photo.remove")} ${i + 1}`}
                className="press absolute -right-2 -top-2 flex size-11 items-center justify-center rounded-full"
              >
                <span className="flex size-7 items-center justify-center rounded-full bg-card shadow-md">
                  <X className="size-4" aria-hidden />
                </span>
              </button>
            </li>
          );
        })}
        {value.length < MASTER_PHOTOS_MAX ? (
          <li>
            <button
              type="button"
              disabled={busy}
              aria-busy={busy}
              onClick={() => input.current?.click()}
              className="press flex aspect-[4/3] w-32 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-border text-sm font-semibold text-primary-ink hover:border-primary/60 disabled:opacity-60"
            >
              <ImagePlus className="size-6" aria-hidden />{" "}
              {busy ? t("easy.photo.checking") : t("easy.photo.add")}
            </button>
          </li>
        ) : null}
      </ul>
      <input
        ref={input}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          void pick(e.target.files);
          e.target.value = "";
        }}
      />
      {error ? (
        <p className="text-sm font-semibold text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
