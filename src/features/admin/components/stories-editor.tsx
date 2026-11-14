"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Film, ImagePlus, Pencil, Power, Trash2 } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { publicEnv } from "@/lib/env-public";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import { callAction } from "@/lib/action-call";
import { cn } from "@/lib/utils";
import { isLive, MAX_VIDEO_BYTES, storyMediaUrl, VIDEO_TYPES, type StoryAudience, type StoryRow } from "@/features/stories/model";
import { deleteStory, reorderStories, saveStory, setStoryActive, startStoryVideoUpload, uploadStoryImage } from "../actions/stories";
import { errorText } from "./note-dialog";

const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const DAYS = ["1", "3", "7", "14", "30", "none"] as const;
const DURATIONS = ["5", "7", "10", "15"] as const;

interface Draft {
  id?: string;
  kind: "image" | "video" | null;
  /** tanlangan fayl (yangi) yoki null — tahrirda eski media qoladi */
  file: File | null;
  preview: string | null;
  mediaPath: string | null;
  posterPath: string | null;
  title: string;
  caption: string;
  ctaLabel: string;
  ctaUrl: string;
  audience: StoryAudience;
  durationSec: string;
  days: (typeof DAYS)[number];
  isActive: boolean;
}

const EMPTY: Draft = {
  kind: null,
  file: null,
  preview: null,
  mediaPath: null,
  posterPath: null,
  title: "",
  caption: "",
  ctaLabel: "",
  ctaUrl: "",
  audience: "all",
  durationSec: "7",
  days: "7",
  isActive: true,
};

/** Rasmni brauzerda kichraytirish (≤ 1920 px, JPEG) — server action hajm chegarasidan oshmasin; server baribir qayta kodlaydi */
async function shrinkTo(file: Blob, max: number): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bmp.width * scale));
  canvas.height = Math.max(1, Math.round(bmp.height * scale));
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("blob"))), "image/jpeg", 0.86));
}

/** Videodan muqova (0.5-soniyadagi kadr): doiracha va video yuklanguncha ko'rinadi */
async function videoPoster(file: File): Promise<Blob | null> {
  const url = URL.createObjectURL(file);
  try {
    const v = document.createElement("video");
    v.muted = true;
    v.playsInline = true;
    v.preload = "auto";
    v.src = url;
    await new Promise<void>((resolve, reject) => {
      v.onloadeddata = () => resolve();
      v.onerror = () => reject(new Error("video"));
      window.setTimeout(() => reject(new Error("timeout")), 15_000);
    });
    v.currentTime = Math.min(0.5, (v.duration || 1) / 2);
    await new Promise<void>((resolve) => {
      v.onseeked = () => resolve();
      window.setTimeout(resolve, 3000);
    });
    const scale = Math.min(1, 720 / Math.max(v.videoWidth || 1, v.videoHeight || 1));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round((v.videoWidth || 720) * scale));
    canvas.height = Math.max(1, Math.round((v.videoHeight || 1280) * scale));
    canvas.getContext("2d")!.drawImage(v, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob | null>((resolve) => canvas.toBlob((b) => resolve(b), "image/jpeg", 0.85));
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Video — bir martalik imzolangan havola bilan to'g'ridan-to'g'ri Storage'ga (jarayon foizi bilan) */
function putSignedVideo(name: string, token: string, file: File, onProgress: (p: number) => void): Promise<boolean> {
  return new Promise((resolve) => {
    const base = publicEnv.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, "");
    const anon = publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", `${base}/storage/v1/object/upload/sign/story-videos/${name}?token=${encodeURIComponent(token)}`);
    xhr.setRequestHeader("apikey", anon);
    xhr.setRequestHeader("authorization", `Bearer ${anon}`);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded / e.total);
    };
    xhr.onload = () => resolve(xhr.status >= 200 && xhr.status < 300);
    xhr.onerror = () => resolve(false);
    const form = new FormData();
    form.append("cacheControl", "31536000");
    form.append("", file);
    xhr.send(form);
  });
}

/** Holat belgisi; server va baza soatlari orasidagi kichik farq "rejalashtirilgan" deb ko'rsatmasin — 1 daqiqa chegara */
function statusOf(s: StoryRow, now: number): "live" | "off" | "ended" | "scheduled" {
  if (!s.is_active) return "off";
  if (s.ends_at && new Date(s.ends_at).getTime() <= now) return "ended";
  if (new Date(s.starts_at).getTime() > now + 60_000) return "scheduled";
  return isLive(s, now + 60_000) ? "live" : "off";
}

/**
 * Admin → "Hikoyalar": "Ish Topdim" nomidan bosh sahifa tepasidagi rasm/video hikoyalar (Instagram'dagidek).
 * Joylash — bir forma: fayl, nom, matn, ixtiyoriy reklama tugmasi, kimga ko'rinadi va necha kun turadi. Ro'yxatda —
 * tartib (yuqoriga/pastga), tahrirlash, yoqish/o'chirish va o'chirish. Har amal audit jurnaliga tushadi.
 */
export function StoriesEditor({ stories, canManage, now }: { stories: StoryRow[]; canManage: boolean; /** sahifa (server) chizilgan vaqt */ now: number }) {
  const { t } = useT();
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));

  const pick = (file: File | undefined) => {
    if (!file) return;
    const isVideo = file.type in VIDEO_TYPES;
    const isImage = /^image\/(jpeg|png|webp|heic|heif)$/.test(file.type);
    if (!isVideo && !isImage) {
      toast.error(t("admin.stories.err_type"));
      return;
    }
    if (file.size > (isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES)) {
      toast.error(t(isVideo ? "admin.stories.err_video_size" : "admin.stories.err_image_size"));
      return;
    }
    if (draft.preview && draft.file) URL.revokeObjectURL(draft.preview);
    set({ kind: isVideo ? "video" : "image", file, preview: URL.createObjectURL(file), mediaPath: null, posterPath: null });
  };

  const edit = (s: StoryRow) => {
    const days = s.ends_at ? String(Math.max(1, Math.round((new Date(s.ends_at).getTime() - Math.max(now, new Date(s.starts_at).getTime())) / 86_400_000))) : "none";
    setDraft({
      id: s.id,
      kind: s.media_kind === "video" ? "video" : "image",
      file: null,
      preview: s.media_kind === "video" ? storyMediaUrl(s.poster_path) : storyMediaUrl(s.media_path),
      mediaPath: s.media_path,
      posterPath: s.poster_path,
      title: s.title,
      caption: s.caption ?? "",
      ctaLabel: s.cta_label ?? "",
      ctaUrl: s.cta_url ?? "",
      audience: (["all", "seeker", "employer"].includes(s.audience) ? s.audience : "all") as StoryAudience,
      durationSec: DURATIONS.includes(String(s.duration_sec) as (typeof DURATIONS)[number]) ? String(s.duration_sec) : "7",
      days: (DAYS as readonly string[]).includes(days) ? (days as Draft["days"]) : "30",
      isActive: s.is_active,
    });
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const reset = () => {
    if (draft.preview && draft.file) URL.revokeObjectURL(draft.preview);
    setDraft(EMPTY);
    setProgress(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  /** Fayl yuklash: rasm — server orqali; video — muqova (server orqali) + video (to'g'ridan-to'g'ri) */
  const uploadMedia = async (file: File, kind: "image" | "video"): Promise<{ mediaPath: string; posterPath: string | null } | string> => {
    const sendImage = async (blob: Blob, max: number) => {
      const form = new FormData();
      form.set("file", new File([await shrinkTo(blob, max).catch(() => blob)], "story.jpg", { type: "image/jpeg" }));
      return callAction(() => uploadStoryImage(form), 60_000);
    };
    if (kind === "image") {
      const res = await sendImage(file, 1920);
      return res.ok && res.data ? { mediaPath: res.data.path, posterPath: null } : res.ok ? "generic" : res.error;
    }
    const poster = await videoPoster(file);
    let posterPath: string | null = null;
    if (poster) {
      const res = await sendImage(poster, 720);
      if (res.ok && res.data) posterPath = res.data.path;
    }
    const ticket = await callAction(() => startStoryVideoUpload({ type: file.type, size: file.size }));
    if (!ticket.ok || !ticket.data) return ticket.ok ? "generic" : ticket.error;
    setProgress(0);
    const ok = await putSignedVideo(ticket.data.name, ticket.data.token, file, (p) => setProgress(Math.round(p * 100)));
    setProgress(null);
    return ok ? { mediaPath: ticket.data.path, posterPath } : "video_upload";
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.kind || (!draft.file && !draft.mediaPath)) {
      toast.error(t("admin.stories.err_no_media"));
      return;
    }
    if (!draft.title.trim()) {
      toast.error(t("admin.stories.err_title"));
      return;
    }
    if (!!draft.ctaLabel.trim() !== !!draft.ctaUrl.trim()) {
      toast.error(t("admin.stories.err_cta_pair"));
      return;
    }
    setBusy("form");
    start(async () => {
      let media = { mediaPath: draft.mediaPath, posterPath: draft.posterPath };
      if (draft.file) {
        const up = await uploadMedia(draft.file, draft.kind!);
        if (typeof up === "string") {
          setBusy(null);
          toast.error(up === "video_upload" ? t("admin.stories.err_video_upload") : errorText(t, up));
          return;
        }
        media = up;
      }
      const res = await callAction(() =>
        saveStory({
          id: draft.id,
          title: draft.title,
          caption: draft.caption.trim() || null,
          kind: draft.kind,
          mediaPath: media.mediaPath,
          posterPath: media.posterPath,
          ctaLabel: draft.ctaLabel.trim() || null,
          ctaUrl: draft.ctaUrl.trim() || null,
          audience: draft.audience,
          durationSec: Number(draft.durationSec),
          days: draft.days === "none" ? null : Number(draft.days),
          isActive: draft.isActive,
        }),
        60_000,
      );
      setBusy(null);
      if (!res.ok) {
        toast.error(res.error === "validation" ? t("admin.stories.err_validation") : errorText(t, res.error));
        return;
      }
      toast.success(t(draft.id ? "admin.stories.saved" : "admin.stories.published"));
      reset();
      router.refresh();
    });
  };

  const act = (key: string, run: () => Promise<{ ok: boolean; error?: string }>, done: string) => {
    setBusy(key);
    start(async () => {
      const res = await run();
      setBusy(null);
      if (!res.ok) {
        toast.error(errorText(t, res.error ?? "generic"));
        return;
      }
      toast.success(t(done));
      router.refresh();
    });
  };

  const move = (i: number, dir: -1 | 1) => {
    const ids = stories.map((s) => s.id);
    const j = i + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j]!, ids[i]!];
    act(`move-${ids[j]}`, () => callAction(() => reorderStories(ids)), "admin.stories.reordered");
  };

  const working = pending || busy !== null;

  return (
    <div className="space-y-6">
      <p className="rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">{t("admin.stories.guide")}</p>

      {canManage ? (
        <form ref={formRef} onSubmit={submit} data-story-form className="grid gap-5 rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:p-5 lg:grid-cols-[13rem_1fr]">
          <div>
            <div className="relative mx-auto aspect-[9/16] w-44 overflow-hidden rounded-xl bg-secondary lg:w-full">
              {draft.preview ? (
                draft.kind === "video" && draft.file ? (
                  <video src={draft.preview} muted playsInline controls className="size-full object-cover" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element -- mahalliy oldindan ko'rish (blob:) yoki storage'dagi WebP
                  <img src={draft.preview} alt="" className="size-full object-cover" />
                )
              ) : (
                <span className="flex size-full flex-col items-center justify-center gap-2 p-4 text-center text-sm text-muted-foreground">
                  <Film className="size-8" aria-hidden />
                  {t("admin.stories.media_hint")}
                </span>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime"
              className="sr-only"
              data-story-file
              aria-label={t("admin.stories.pick")}
              onChange={(e) => pick(e.target.files?.[0])}
            />
            <Button type="button" variant="outline" className="mt-3 w-full" onClick={() => fileRef.current?.click()} disabled={working}>
              <ImagePlus className="size-4" aria-hidden /> {draft.preview ? t("admin.stories.repick") : t("admin.stories.pick")}
            </Button>
            <p className="mt-2 text-xs text-muted-foreground">{t("admin.stories.media_spec")}</p>
          </div>

          <div className="grid content-start gap-4">
            <h2 className="text-lg font-extrabold">{draft.id ? t("admin.stories.edit_title") : t("admin.stories.new_title")}</h2>
            <label className="grid gap-1.5 text-sm font-medium">
              {t("admin.stories.f_title")}
              <Input value={draft.title} maxLength={40} required onChange={(e) => set({ title: e.target.value })} placeholder={t("admin.stories.f_title_ph")} data-story-title />
              <span className="text-xs font-normal text-muted-foreground">{t("admin.stories.f_title_hint", { n: 40 - draft.title.length })}</span>
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              {t("admin.stories.f_caption")}
              <Textarea value={draft.caption} maxLength={300} rows={3} onChange={(e) => set({ caption: e.target.value })} placeholder={t("admin.stories.f_caption_ph")} />
            </label>
            <fieldset className="grid gap-3 rounded-xl border border-border p-3 sm:grid-cols-2">
              <legend className="px-1 text-sm font-semibold">{t("admin.stories.f_cta")}</legend>
              <label className="grid gap-1.5 text-sm font-medium">
                {t("admin.stories.f_cta_label")}
                <Input value={draft.ctaLabel} maxLength={30} onChange={(e) => set({ ctaLabel: e.target.value })} placeholder={t("admin.stories.f_cta_label_ph")} data-story-cta-label />
              </label>
              <label className="grid gap-1.5 text-sm font-medium">
                {t("admin.stories.f_cta_url")}
                <Input value={draft.ctaUrl} maxLength={500} inputMode="url" onChange={(e) => set({ ctaUrl: e.target.value })} placeholder="/post/vacancy" data-story-cta-url />
              </label>
              <p className="text-xs text-muted-foreground sm:col-span-2">{t("admin.stories.f_cta_hint")}</p>
            </fieldset>
            <div className="grid gap-4 sm:grid-cols-3">
              <label className="grid gap-1.5 text-sm font-medium">
                {t("admin.stories.f_audience")}
                <Select
                  value={draft.audience}
                  onChange={(e) => set({ audience: e.target.value as StoryAudience })}
                  options={(["all", "seeker", "employer"] as const).map((a) => ({ value: a, label: t(`admin.stories.aud_${a}`) }))}
                />
              </label>
              <label className="grid gap-1.5 text-sm font-medium">
                {t("admin.stories.f_days")}
                <Select
                  value={draft.days}
                  onChange={(e) => set({ days: e.target.value as Draft["days"] })}
                  options={DAYS.map((d) => ({ value: d, label: d === "none" ? t("admin.stories.days_none") : t("admin.stories.days_n", { n: Number(d) }) }))}
                />
              </label>
              <label className={cn("grid gap-1.5 text-sm font-medium", draft.kind === "video" && "opacity-50")}>
                {t("admin.stories.f_duration")}
                <Select
                  value={draft.durationSec}
                  disabled={draft.kind === "video"}
                  onChange={(e) => set({ durationSec: e.target.value })}
                  options={DURATIONS.map((d) => ({ value: d, label: t("admin.stories.sec_n", { n: Number(d) }) }))}
                />
              </label>
            </div>
            <label className="flex min-h-11 items-center gap-2 text-sm font-medium">
              <input type="checkbox" checked={draft.isActive} onChange={(e) => set({ isActive: e.target.checked })} className="size-5 accent-[var(--primary)]" />
              {t("admin.stories.f_active")}
            </label>
            {progress !== null ? (
              <div role="status" className="grid gap-1 text-sm">
                {t("admin.stories.uploading", { p: progress })}
                <span className="h-2 overflow-hidden rounded-full bg-secondary">
                  <span className="block h-full bg-primary transition-[width]" style={{ width: `${progress}%` }} />
                </span>
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={working} data-story-submit>
                {busy === "form" ? t("admin.stories.saving") : draft.id ? t("admin.stories.save") : t("admin.stories.publish")}
              </Button>
              {draft.id || draft.preview ? (
                <Button type="button" variant="ghost" onClick={reset} disabled={working}>
                  {t("admin.stories.cancel")}
                </Button>
              ) : null}
            </div>
          </div>
        </form>
      ) : null}

      <section aria-labelledby="stories-list" className="space-y-3">
        <h2 id="stories-list" className="text-lg font-extrabold">
          {t("admin.stories.list_title", { n: stories.length })}
        </h2>
        {stories.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">{t("admin.stories.empty")}</p>
        ) : (
          <ul className="grid gap-3">
            {stories.map((s, i) => {
              const st = statusOf(s, now);
              const thumb = s.media_kind === "video" ? storyMediaUrl(s.poster_path) : storyMediaUrl(s.media_path);
              return (
                <li key={s.id} data-story-row={s.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-border/70 bg-card p-3 shadow-sm">
                  <span className="relative block h-20 w-12 shrink-0 overflow-hidden rounded-lg bg-secondary">
                    {thumb ? (
                      // eslint-disable-next-line @next/next/no-img-element -- storage'dagi WebP
                      <img src={thumb} alt="" className="size-full object-cover" loading="lazy" />
                    ) : null}
                    {s.media_kind === "video" ? <Film className="absolute bottom-1 right-1 size-4 rounded-xs bg-black/60 p-0.5 text-white" aria-hidden /> : null}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold">{s.title}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                      <Badge variant={st === "live" ? "success" : "outline"} data-story-status={st}>
                        {t(`admin.stories.st_${st}`)}
                      </Badge>
                      <span>{t(`admin.stories.aud_${s.audience}`)}</span>
                      <span>· {s.ends_at ? t("admin.stories.until", { date: new Date(s.ends_at).toLocaleDateString("ru-RU") }) : t("admin.stories.days_none")}</span>
                      {s.cta_label ? <span>· {t("admin.stories.has_cta", { label: s.cta_label })}</span> : null}
                    </div>
                  </div>
                  {canManage ? (
                    <div className="flex flex-wrap gap-1">
                      <Button type="button" size="icon" variant="ghost" aria-label={t("admin.stories.up")} disabled={working || i === 0} onClick={() => move(i, -1)}>
                        <ArrowUp className="size-4" aria-hidden />
                      </Button>
                      <Button type="button" size="icon" variant="ghost" aria-label={t("admin.stories.down")} disabled={working || i === stories.length - 1} onClick={() => move(i, 1)}>
                        <ArrowDown className="size-4" aria-hidden />
                      </Button>
                      <Button type="button" size="icon" variant="ghost" aria-label={t("admin.stories.edit")} disabled={working} onClick={() => edit(s)}>
                        <Pencil className="size-4" aria-hidden />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        aria-label={s.is_active ? t("admin.stories.turn_off") : t("admin.stories.turn_on")}
                        disabled={working}
                        data-story-toggle
                        onClick={() => act(`toggle-${s.id}`, () => callAction(() => setStoryActive(s.id, !s.is_active)), s.is_active ? "admin.stories.turned_off" : "admin.stories.turned_on")}
                      >
                        <Power className={cn("size-4", s.is_active ? "text-success" : "text-muted-foreground")} aria-hidden />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        aria-label={t("admin.stories.delete")}
                        disabled={working}
                        data-story-delete
                        onClick={() => {
                          if (!window.confirm(t("admin.stories.delete_confirm", { title: s.title }))) return;
                          act(`delete-${s.id}`, () => callAction(() => deleteStory(s.id)), "admin.stories.deleted");
                        }}
                      >
                        <Trash2 className="size-4 text-destructive" aria-hidden />
                      </Button>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
