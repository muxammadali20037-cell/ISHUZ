"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, FileText, Film, Loader2, Plus, Trash2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { saveAvatar } from "../actions";
import { AVATAR_MAX_MB, AVATAR_MIME } from "../types";
import { fileExtension, storagePathFromPublicUrl, validateFile } from "../utils";
import { errorMessage } from "./wizard-shell";

const IMAGE_EXT = new Set(["jpg", "jpeg", "png", "webp"]);

function fileNameOf(path: string) {
  return path.split("/").pop() ?? path;
}

/**
 * Avatar: client → storage "avatars/<userId>/avatar.<ext>" (upsert) → public URL → profiles.avatar_url (server action).
 */
export function AvatarUpload({ userId, url, fallback }: { userId: string; url: string | null; fallback: string }) {
  const { t } = useT();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [current, setCurrent] = useState<string | null>(url);
  const [busy, setBusy] = useState(false);

  const upload = async (file: File) => {
    const invalid = validateFile(file, AVATAR_MIME, AVATAR_MAX_MB);
    if (invalid) {
      toast.error(t(invalid.key, invalid.params));
      return;
    }
    setBusy(true);
    try {
      const supabase = createClient();
      const path = `${userId}/avatar.${fileExtension(file)}`;
      const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true, contentType: file.type, cacheControl: "3600" });
      if (error) throw error;
      const publicUrl = `${supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl}?v=${Date.now()}`;
      const res = await saveAvatar({ url: publicUrl });
      if (!res.ok) {
        toast.error(errorMessage(t, res.error));
        return;
      }
      setCurrent(publicUrl);
      toast.success(t("onboarding.worker.personal.avatar_saved"));
      router.refresh();
    } catch (e) {
      console.error("[onboarding] avatar upload", e);
      toast.error(t("onboarding.worker.errors.upload_failed"));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const remove = async () => {
    if (!current) return;
    setBusy(true);
    try {
      const res = await saveAvatar({ url: null });
      if (!res.ok) {
        toast.error(errorMessage(t, res.error));
        return;
      }
      const path = storagePathFromPublicUrl(current, "avatars");
      if (path) await createClient().storage.from("avatars").remove([path]);
      setCurrent(null);
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4">
      <div className="relative shrink-0">
        <Avatar src={current} fallback={fallback} size="xl" />
        {busy ? (
          <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 text-white">
            <Loader2 className="size-6 animate-spin" />
          </span>
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{t("onboarding.worker.personal.avatar_title")}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{t("onboarding.worker.personal.avatar_hint", { max: AVATAR_MAX_MB })}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="secondary" disabled={busy} onClick={() => inputRef.current?.click()}>
            <Camera className="size-4" />
            {current ? t("onboarding.worker.personal.avatar_change") : t("onboarding.worker.personal.avatar_upload")}
          </Button>
          {current ? (
            <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={remove}>
              <Trash2 className="size-4" />
              {t("common.actions.delete")}
            </Button>
          ) : null}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={AVATAR_MIME.join(",")}
          className="sr-only"
          aria-label={t("onboarding.worker.personal.avatar_upload")}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void upload(file);
          }}
        />
      </div>
    </div>
  );
}

/**
 * Ko'p fayl yuklash (portfolio): "portfolio/<userId>/<uuid>.<ext>". Qiymat — storage yo'llari.
 */
export function FileUpload({
  userId,
  value,
  onChange,
  accept,
  maxFiles,
  maxSizeMb,
  invalid,
}: {
  userId: string;
  value: string[];
  onChange: (paths: string[]) => void;
  accept: readonly string[];
  maxFiles: number;
  maxSizeMb: number;
  invalid?: boolean;
}) {
  const { t } = useT();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(0);
  const supabase = createClient();
  const publicUrl = (path: string) => supabase.storage.from("portfolio").getPublicUrl(path).data.publicUrl;

  const addFiles = async (files: File[]) => {
    const room = maxFiles - value.length;
    if (files.length > room) toast.error(t("onboarding.worker.errors.max_files", { max: maxFiles }));
    const batch = files.slice(0, Math.max(room, 0));
    const added: string[] = [];
    for (const file of batch) {
      const bad = validateFile(file, accept, maxSizeMb);
      if (bad) {
        toast.error(t(bad.key, bad.params));
        continue;
      }
      setUploading((n) => n + 1);
      try {
        const path = `${userId}/${crypto.randomUUID()}.${fileExtension(file)}`;
        const { error } = await supabase.storage.from("portfolio").upload(path, file, { contentType: file.type, cacheControl: "3600" });
        if (error) throw error;
        added.push(path);
      } catch (e) {
        console.error("[onboarding] portfolio upload", e);
        toast.error(t("onboarding.worker.errors.upload_failed"));
      } finally {
        setUploading((n) => n - 1);
      }
    }
    if (added.length) onChange([...value, ...added]);
    if (inputRef.current) inputRef.current.value = "";
  };

  const remove = (path: string) => {
    onChange(value.filter((p) => p !== path));
    void supabase.storage.from("portfolio").remove([path]);
  };

  const canAdd = value.length + uploading < maxFiles;
  return (
    <div>
      <div className={cn("grid grid-cols-3 gap-2 sm:grid-cols-4", invalid && "rounded-xl ring-2 ring-destructive/40")}>
        {value.map((path) => {
          const ext = path.split(".").pop()?.toLowerCase() ?? "";
          const isImage = IMAGE_EXT.has(ext);
          return (
            <div key={path} className="group relative aspect-square overflow-hidden rounded-xl border border-border bg-secondary">
              {isImage ? (
                // eslint-disable-next-line @next/next/no-img-element -- foydalanuvchi yuklagan storage fayli
                <img src={publicUrl(path)} alt="" className="size-full object-cover" loading="lazy" />
              ) : (
                <div className="flex size-full flex-col items-center justify-center gap-1 p-2 text-center text-muted-foreground">
                  {ext === "mp4" ? <Film className="size-7" /> : <FileText className="size-7" />}
                  <span className="w-full truncate text-[11px]">{fileNameOf(path)}</span>
                </div>
              )}
              <button
                type="button"
                onClick={() => remove(path)}
                aria-label={t("common.actions.delete")}
                className="absolute right-1 top-1 flex size-7 items-center justify-center rounded-full bg-black/55 text-white hover:bg-black/70"
              >
                <X className="size-4" />
              </button>
            </div>
          );
        })}
        {Array.from({ length: uploading }).map((_, i) => (
          <div key={`up-${i}`} className="flex aspect-square items-center justify-center rounded-xl border border-dashed border-border bg-secondary/60">
            <Loader2 className="size-6 animate-spin text-primary" />
          </div>
        ))}
        {canAdd ? (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-border text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
          >
            <Plus className="size-6" />
            <span className="text-xs font-medium">{t("common.actions.upload")}</span>
          </button>
        ) : null}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{t("onboarding.worker.portfolio.upload_hint", { max: maxFiles, size: maxSizeMb })}</p>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={accept.join(",")}
        className="sr-only"
        aria-label={t("common.actions.upload")}
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length) void addFiles(files);
        }}
      />
    </div>
  );
}
