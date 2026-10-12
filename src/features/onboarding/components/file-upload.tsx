"use client";

import { useRef, useState } from "react";
import { FileText, Film, Loader2, Plus, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/toast";
import { fileExtension, validateFile } from "../utils";

const IMAGE_EXT = new Set(["jpg", "jpeg", "png", "webp"]);

function fileNameOf(path: string) {
  return path.split("/").pop() ?? path;
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
                  <span className="w-full truncate text-2xs">{fileNameOf(path)}</span>
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
