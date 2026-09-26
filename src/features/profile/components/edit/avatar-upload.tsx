"use client";

import { useRef, useState } from "react";
import { Camera, Trash2 } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { createClient } from "@/lib/supabase/client";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { removeAvatar, setAvatar } from "../../actions";
import { checkAvatarFile } from "../../pure";
import { useAction } from "../use-action";

/** Profil rasmi: avatars/<userId>/avatar.<ext> (≤3MB, jpeg/png/webp) → profiles.avatar_url */
export function AvatarUpload({ userId, avatarUrl, fallback }: { userId: string; avatarUrl: string | null; fallback: string }) {
  const { t } = useT();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(avatarUrl);
  const [uploading, setUploading] = useState(false);
  const { pending, run } = useAction();
  const busy = uploading || pending;

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    const check = checkAvatarFile(file);
    if (!check.ok) {
      toast.error(t(`common.errors.${check.error}`, { max: 3 }));
      return;
    }
    setUploading(true);
    const path = `${userId}/avatar.${check.ext}`;
    const { error } = await createClient().storage.from("avatars").upload(path, file, { upsert: true, contentType: file.type, cacheControl: "3600" });
    setUploading(false);
    if (error) {
      toast.error(t("profile.errors.upload_failed"));
      return;
    }
    const local = URL.createObjectURL(file);
    run(() => setAvatar({ path }), {
      success: t("profile.toast.uploaded"),
      onSuccess: (d) => setPreview(d?.url ?? local),
    });
  };

  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="group relative shrink-0 rounded-full focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={preview ? t("profile.labels.change_photo") : t("profile.labels.upload_photo")}
      >
        <Avatar src={preview} fallback={fallback} size="2xl" className="ring-4 ring-primary-soft" />
        <span className="absolute bottom-0 right-0 flex size-9 items-center justify-center rounded-full border-2 border-card bg-primary text-primary-foreground shadow-sm">
          <Camera className="size-4" />
        </span>
      </button>
      <div className="min-w-0 space-y-2">
        <p className="text-sm font-medium">{t("profile.labels.photo")}</p>
        <p className="text-xs text-muted-foreground">{t("profile.labels.photo_hint")}</p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" loading={busy} onClick={() => inputRef.current?.click()}>
            {preview ? t("profile.labels.change_photo") : t("profile.labels.upload_photo")}
          </Button>
          {preview ? (
            <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => run(() => removeAvatar(), { success: t("profile.toast.deleted"), onSuccess: () => setPreview(null) })}>
              <Trash2 className="size-4" /> {t("profile.labels.remove_photo")}
            </Button>
          ) : null}
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={(e) => {
          void onFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </div>
  );
}
