"use client";

import { useRef, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Upload, X } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { ChipGroup } from "@/components/ui/chip";
import { Dialog, Sheet } from "@/components/ui/dialog";
import { Input, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { toast } from "@/components/ui/toast";
import { Constants, type Enums } from "@/types/database.types";
import { savePortfolioItem } from "../../actions";
import { checkPortfolioFile, PORTFOLIO_MAX_FILES, PORTFOLIO_TYPE_MIME, type PortfolioType } from "../../pure";
import type { WorkerPortfolioItem } from "../../queries";
import { MediaThumb } from "../media-thumb";
import { useAction } from "../use-action";
import { fieldError } from "../edit/form-utils";

const formSchema = z
  .object({
    title: z.string().trim().min(2, "min_length").max(120, "max_length"),
    description: z.string().trim().max(1000, "max_length"),
    type: z.enum(Constants.public.Enums.portfolio_type),
    link_url: z.string().trim().max(500, "max_length"),
  })
  .refine((d) => !d.link_url || /^https?:\/\/\S+$/i.test(d.link_url), { message: "invalid_url", path: ["link_url"] })
  .refine((d) => d.type !== "link" || !!d.link_url, { message: "link_required", path: ["link_url"] });
type FormValues = z.infer<typeof formSchema>;

type Pending = { file: File; preview: string | null };

export function PortfolioDialog({ item, userId, onClose }: { item: WorkerPortfolioItem | null; userId: string; onClose: () => void }) {
  const { t, tEnum } = useT();
  const { pending, run } = useAction();
  const inputRef = useRef<HTMLInputElement>(null);
  const [existing, setExisting] = useState(item?.media ?? []);
  const [files, setFiles] = useState<Pending[]>([]);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { title: item?.title ?? "", description: item?.description ?? "", type: item?.type ?? "image", link_url: item?.link_url ?? "" },
  });
  const { errors } = form.formState;
  const type = useWatch({ control: form.control, name: "type" }) as PortfolioType;
  const totalFiles = existing.length + files.length;
  const busy = pending || !!progress;

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const next: Pending[] = [];
    for (const file of Array.from(list)) {
      if (totalFiles + next.length >= PORTFOLIO_MAX_FILES) {
        toast.error(t("profile.errors.too_many_files", { max: PORTFOLIO_MAX_FILES }));
        break;
      }
      const check = checkPortfolioFile(file, type);
      if (!check.ok) {
        toast.error(t(`common.errors.${check.error}`, { max: 25 }));
        continue;
      }
      next.push({ file, preview: file.type.startsWith("image/") ? URL.createObjectURL(file) : null });
    }
    if (next.length) setFiles((f) => [...f, ...next]);
  };

  const submit = form.handleSubmit(async (v) => {
    const isLink = v.type === "link";
    if (!isLink && totalFiles === 0) {
      toast.error(t("profile.errors.media_required"));
      return;
    }
    const supabase = createClient();
    const uploaded: string[] = [];
    if (!isLink && files.length) {
      setProgress({ done: 0, total: files.length });
      for (const [i, f] of files.entries()) {
        const check = checkPortfolioFile(f.file, v.type as PortfolioType);
        if (!check.ok) continue;
        const path = `${userId}/${crypto.randomUUID()}.${check.ext}`;
        const { error } = await supabase.storage.from("portfolio").upload(path, f.file, { contentType: f.file.type, cacheControl: "3600" });
        if (error) {
          setProgress(null);
          if (uploaded.length) await supabase.storage.from("portfolio").remove(uploaded);
          toast.error(t("profile.errors.upload_failed"));
          return;
        }
        uploaded.push(path);
        setProgress({ done: i + 1, total: files.length });
      }
      setProgress(null);
    }
    run(
      () =>
        savePortfolioItem({
          id: item?.id,
          title: v.title,
          description: v.description,
          type: v.type,
          media_paths: isLink ? [] : [...existing.map((m) => m.path), ...uploaded],
          link_url: v.link_url || null,
        }),
      {
        onSuccess: onClose,
        onError: () => {
          if (uploaded.length) void supabase.storage.from("portfolio").remove(uploaded);
        },
      },
    );
  });

  const accept = PORTFOLIO_TYPE_MIME[type].join(",");

  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <Sheet
        title={item ? t("profile.portfolio.edit") : t("profile.portfolio.add")}
        footer={
          <Button type="submit" form="portfolio-form" fullWidth loading={busy}>
            {progress ? t("profile.portfolio.uploading", progress) : t("common.actions.save")}
          </Button>
        }
      >
        <form id="portfolio-form" onSubmit={submit} className="space-y-4 pb-2">
          <Field label={t("profile.portfolio.item_type")}>
            <Controller
              control={form.control}
              name="type"
              render={({ field }) => (
                <ChipGroup
                  size="sm"
                  options={Constants.public.Enums.portfolio_type.map((v) => ({ value: v, label: tEnum("portfolio_type", v) }))}
                  value={field.value}
                  onChange={(v) => v && !Array.isArray(v) && field.onChange(v as Enums<"portfolio_type">)}
                />
              )}
            />
          </Field>
          <Field label={t("profile.portfolio.item_title")} htmlFor="pf-title" required error={fieldError(t, errors.title?.message, { min: 2, max: 120 })}>
            <Input id="pf-title" maxLength={120} placeholder={t("profile.portfolio.item_title_placeholder")} invalid={!!errors.title} {...form.register("title")} />
          </Field>
          <Field label={t("profile.portfolio.item_description")} htmlFor="pf-desc" hint={t("profile.labels.optional")} error={fieldError(t, errors.description?.message, { max: 1000 })}>
            <Textarea id="pf-desc" rows={3} maxLength={1000} className="min-h-[80px]" {...form.register("description")} />
          </Field>

          {type !== "link" ? (
            <Field label={t("profile.portfolio.files")} description={t("profile.portfolio.files_hint", { max: PORTFOLIO_MAX_FILES })}>
              {existing.length || files.length ? (
                <div className="mb-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {existing.map((m) => (
                    <FileTile key={m.path} onRemove={() => setExisting(existing.filter((x) => x.path !== m.path))} label={t("profile.portfolio.remove_file")}>
                      <MediaThumb path={m.path} url={m.url} />
                    </FileTile>
                  ))}
                  {files.map((f, i) => (
                    <FileTile key={`${f.file.name}-${i}`} onRemove={() => setFiles(files.filter((_, j) => j !== i))} label={t("profile.portfolio.remove_file")}>
                      {f.preview ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={f.preview} alt="" className="size-full object-cover" />
                      ) : (
                        <span className="flex size-full items-center justify-center px-1 text-center text-[11px] text-muted-foreground">{f.file.name}</span>
                      )}
                    </FileTile>
                  ))}
                </div>
              ) : null}
              <Button type="button" variant="outline" size="sm" disabled={busy || totalFiles >= PORTFOLIO_MAX_FILES} onClick={() => inputRef.current?.click()}>
                <Upload className="size-4" /> {t("profile.portfolio.choose_files")} ({totalFiles}/{PORTFOLIO_MAX_FILES})
              </Button>
              <input
                ref={inputRef}
                type="file"
                multiple
                accept={accept}
                className="sr-only"
                onChange={(e) => {
                  addFiles(e.target.files);
                  e.target.value = "";
                }}
              />
            </Field>
          ) : null}

          <Field label={t("profile.portfolio.link_url")} htmlFor="pf-link" required={type === "link"} hint={type === "link" ? undefined : t("profile.labels.optional")} error={fieldError(t, errors.link_url?.message, { max: 500 })}>
            <Input id="pf-link" type="url" inputMode="url" placeholder={t("profile.portfolio.link_placeholder")} invalid={!!errors.link_url} {...form.register("link_url")} />
          </Field>
        </form>
      </Sheet>
    </Dialog>
  );
}

function FileTile({ children, onRemove, label }: { children: React.ReactNode; onRemove: () => void; label: string }) {
  return (
    <div className="relative aspect-square overflow-hidden rounded-xl border border-border bg-secondary">
      {children}
      <button type="button" onClick={onRemove} aria-label={label} className="absolute right-1 top-1 flex size-7 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80">
        <X className="size-4" />
      </button>
    </div>
  );
}
