"use client";

import { useRef, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, ImagePlus, Plus, RotateCcw, Save, Trash2, Undo2 } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { LOCALES, type Locale } from "@/lib/i18n/config";
import { publicEnv } from "@/lib/env";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/checkbox";
import { ConfirmDialog } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import { callAction } from "@/lib/action-call";
import { MAX_WINDOWS, WINDOW_ART, WINDOW_AUDIENCES, isBuiltinWindow, windowAudience, type BuiltinWindow, type HomeWindow, type WindowArt, type WindowAudience } from "@/features/home-windows/model";
import { WindowArtwork } from "@/features/home-windows/window-art";
import { saveHomeWindows, setAiSearchButton, uploadWindowImage } from "../actions/home";
import { errorText } from "./note-dialog";

const LOCALE_LABEL: Record<Locale, string> = { uz: "O'zbek", oz: "Ўзбек", ru: "Русский", en: "English" };

/** Yuklashdan oldin brauzerda kichraytirish (≤1600 px, JPEG): server action hajm chegarasidan oshmasin; server baribir qayta kodlaydi */
async function shrink(file: File): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bmp.width * scale));
    canvas.height = Math.max(1, Math.round(bmp.height * scale));
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("blob"))), "image/jpeg", 0.88));
  } catch {
    // rasm sifatida ochilmadi — asl fayl yuboriladi, server tushunarli xato qaytaradi
    return file;
  }
}

/**
 * Admin → "Bosh sahifa": tepadagi rasmli oynalar (tartib, matn 4 tilda, havola, rasm) va lupa tugmasi.
 * O'zgarishlar "Saqlash" bilan bitta yozuvda saqlanadi va saytda darhol ko'rinadi; har biri audit jurnaliga tushadi.
 */
export type WindowDefaults = Record<BuiltinWindow, Record<Locale, { title: string; desc: string }>>;

export function HomeEditor({
  windows: initial,
  defaults,
  aiButton,
  canManage,
  ready,
}: {
  windows: HomeWindow[];
  /** standart oynalarning 4 tildagi matni — maydon bo'sh qolsa saytda shu ko'rinadi (joy egallovchi sifatida ko'rsatiladi) */
  defaults: WindowDefaults;
  aiButton: boolean;
  canManage: boolean;
  ready: boolean;
}) {
  const { t } = useT();
  const [list, setList] = useState<HomeWindow[]>(initial);
  const [ai, setAi] = useState(aiButton);
  const [dirty, setDirty] = useState(false);
  const [pending, start] = useTransition();
  const [uploading, setUploading] = useState<string | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const uploadFor = useRef<string | null>(null);
  const disabled = !canManage || !ready || pending;

  const change = (id: string, patch: Partial<HomeWindow>) => {
    setList((l) => l.map((w) => (w.id === id ? { ...w, ...patch } : w)));
    setDirty(true);
  };
  const move = (i: number, d: -1 | 1) => {
    setList((l) => {
      const next = [...l];
      [next[i], next[i + d]] = [next[i + d]!, next[i]!];
      return next;
    });
    setDirty(true);
  };

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, success: string, after?: () => void) =>
    start(async () => {
      const res = await callAction(fn as () => Promise<{ ok: true } | { ok: false; error: string }>);
      if (!res.ok) {
        toast.error(errorText(t, res.error));
        return;
      }
      toast.success(success);
      after?.();
    });

  const onFile = async (file: File | undefined) => {
    const id = uploadFor.current;
    if (!file || !id) return;
    setUploading(id);
    const form = new FormData();
    form.set("file", new File([await shrink(file)], "window.jpg", { type: "image/jpeg" }));
    const res = await callAction(() => uploadWindowImage(form));
    setUploading(null);
    if (!res.ok || !res.data) {
      toast.error(errorText(t, res.ok ? "generic" : res.error));
      return;
    }
    change(id, { image: res.data.path });
  };

  return (
    <div className="space-y-6">
      {!ready ? <p className="rounded-xl border border-warning/40 bg-warning-soft px-4 py-3 text-sm">{t("admin.home.needs_migration")}</p> : null}

      <section className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-base font-semibold">{t("admin.home.ai_button")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t("admin.home.ai_button_hint")}</p>
          </div>
          <Switch
            checked={ai}
            disabled={disabled}
            aria-label={t("admin.home.ai_button")}
            onCheckedChange={(on) => run(() => setAiSearchButton({ enabled: on }), t("admin.home.saved"), () => setAi(on))}
          />
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">{t("admin.home.windows")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t("admin.home.windows_hint")}</p>
          </div>
          {!canManage ? <Badge size="sm">{t("admin.settings.read_only")}</Badge> : null}
        </div>

        <ol className="space-y-4">
          {list.map((w, i) => (
            <li key={w.id} className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:p-5" aria-label={t("admin.home.window_n", { n: i + 1 })}>
              <div className="grid gap-4 md:grid-cols-[220px_1fr]">
                <div className="space-y-2">
                  <div className="aspect-[16/9] overflow-hidden rounded-xl border border-border bg-primary-soft">
                    {w.image ? (
                      // eslint-disable-next-line @next/next/no-img-element -- admin oldindan ko'rinishi: o'z storage'imizdagi tekshirilgan WebP
                      <img src={`${publicEnv.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, "")}/storage/v1/object/public/${w.image}`} alt="" className="size-full object-cover" />
                    ) : (
                      <WindowArtwork art={w.art ?? "jobs"} />
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={disabled}
                      loading={uploading === w.id}
                      onClick={() => {
                        uploadFor.current = w.id;
                        fileRef.current?.click();
                      }}
                    >
                      <ImagePlus className="size-4" /> {w.image ? t("admin.home.replace") : t("admin.home.upload")}
                    </Button>
                    {w.image ? (
                      <Button type="button" size="sm" variant="ghost" disabled={disabled} onClick={() => change(w.id, { image: null })}>
                        <Undo2 className="size-4" /> {t("admin.home.remove_image")}
                      </Button>
                    ) : null}
                  </div>
                  {!w.image ? (
                    <label className="block text-sm">
                      <span className="mb-1 block font-medium">{t("admin.home.art")}</span>
                      <select
                        className="h-10 w-full rounded-lg border border-input bg-card px-2 text-sm"
                        value={w.art ?? "jobs"}
                        disabled={disabled}
                        onChange={(e) => change(w.id, { art: e.target.value as WindowArt })}
                      >
                        {WINDOW_ART.map((a) => (
                          <option key={a} value={a}>
                            {t(`admin.home.art_${a}`)}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                </div>

                <div className="min-w-0 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="flex items-center gap-3 text-sm font-medium">
                      <Switch checked={w.enabled} disabled={disabled} onCheckedChange={(on) => change(w.id, { enabled: on })} aria-label={t("admin.home.enabled")} />
                      {t("admin.home.enabled")}
                    </label>
                    <div className="flex gap-1">
                      <Button type="button" size="icon" variant="ghost" disabled={disabled || i === 0} onClick={() => move(i, -1)} aria-label={t("admin.home.move_up")}>
                        <ArrowUp className="size-4" />
                      </Button>
                      <Button type="button" size="icon" variant="ghost" disabled={disabled || i === list.length - 1} onClick={() => move(i, 1)} aria-label={t("admin.home.move_down")}>
                        <ArrowDown className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        disabled={disabled || list.length <= 1}
                        onClick={() => {
                          setList((l) => l.filter((x) => x.id !== w.id));
                          setDirty(true);
                        }}
                        aria-label={t("admin.home.remove")}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                  <label className="block text-sm">
                    <span className="mb-1 block font-medium">{t("admin.home.audience")}</span>
                    <select
                      className="h-10 w-full rounded-lg border border-input bg-card px-2 text-sm"
                      value={windowAudience(w)}
                      disabled={disabled}
                      onChange={(e) => change(w.id, { audience: e.target.value as WindowAudience })}
                    >
                      {WINDOW_AUDIENCES.map((a) => (
                        <option key={a} value={a}>
                          {t(`admin.home.audience_${a}`)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-sm">
                    <span className="mb-1 block font-medium">{t("admin.home.link")}</span>
                    <Input value={w.href} disabled={disabled} onChange={(e) => change(w.id, { href: e.target.value.trim().slice(0, 300) })} placeholder="/search?mode=jobs" />
                    <span className="mt-1 block text-xs text-muted-foreground">{t("admin.home.link_hint")}</span>
                  </label>
                  <div className="grid gap-3 lg:grid-cols-2">
                    {LOCALES.map((l) => (
                      <fieldset key={l} className="space-y-2 rounded-xl border border-border p-3">
                        <legend className="px-1 text-xs font-semibold text-muted-foreground">{LOCALE_LABEL[l]}</legend>
                        <Input
                          value={w.title[l] ?? ""}
                          disabled={disabled}
                          maxLength={80}
                          onChange={(e) => change(w.id, { title: { ...w.title, [l]: e.target.value } })}
                          placeholder={isBuiltinWindow(w.id) ? defaults[w.id][l].title : t("admin.home.title_field")}
                          aria-label={`${t("admin.home.title_field")} (${LOCALE_LABEL[l]})`}
                        />
                        <Input
                          value={w.desc[l] ?? ""}
                          disabled={disabled}
                          maxLength={140}
                          onChange={(e) => change(w.id, { desc: { ...w.desc, [l]: e.target.value } })}
                          placeholder={isBuiltinWindow(w.id) ? defaults[w.id][l].desc : t("admin.home.desc_field")}
                          aria-label={`${t("admin.home.desc_field")} (${LOCALE_LABEL[l]})`}
                        />
                      </fieldset>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">{t("admin.home.desc_hint")}</p>
                </div>
              </div>
            </li>
          ))}
        </ol>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={disabled || list.length >= MAX_WINDOWS}
            onClick={() => {
              setList((l) => [...l, { id: `w${Date.now().toString(36)}`, enabled: true, art: "jobs", image: null, href: "/search?mode=jobs", audience: "worker", title: {}, desc: {} }]);
              setDirty(true);
            }}
          >
            <Plus className="size-4" /> {t("admin.home.add")}
          </Button>
          <Button type="button" variant="ghost" disabled={disabled} onClick={() => setResetOpen(true)}>
            <RotateCcw className="size-4" /> {t("admin.home.reset")}
          </Button>
        </div>
        {/* telefonda faqat "Saqlash" yopishqoq — uch tugma uch qatorga bo'linib ekranning choragini yopardi */}
        <div className="sticky bottom-3 z-10 flex justify-end rounded-2xl border border-border bg-card p-2 shadow-md">
          <Button
            type="button"
            className="w-full sm:w-auto"
            disabled={disabled || !dirty}
            loading={pending}
            onClick={() =>
              run(
                () => saveHomeWindows({ windows: list.map((w) => ({ ...w, title: clean(w.title), desc: clean(w.desc) })) }),
                t("admin.home.saved"),
                () => setDirty(false),
              )
            }
          >
            <Save className="size-4" /> {t("admin.home.save")}
          </Button>
        </div>
      </section>

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          void onFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <ConfirmDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        title={t("admin.home.reset")}
        description={t("admin.home.reset_confirm")}
        confirmLabel={t("admin.home.reset")}
        cancelLabel={t("common.actions.cancel")}
        onConfirm={() => run(() => saveHomeWindows({ windows: null }), t("admin.home.saved"), () => window.location.reload())}
      />
    </div>
  );
}

/** bo'sh matnlar saqlanmaydi (o'sha tilda standart matn ko'rinadi) */
function clean(map: Partial<Record<Locale, string>>): Partial<Record<Locale, string>> {
  return Object.fromEntries(Object.entries(map).map(([k, v]) => [k, v?.trim()]).filter(([, v]) => v)) as Partial<Record<Locale, string>>;
}
