"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Undo2 } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toast";
import { callAction } from "@/lib/action-call";
import { SLOT_GROUPS, SLOT_SPEC, type EntryMedia, type EntrySlot } from "@/features/entry/media";
import { EntryImage } from "@/features/entry/components/entry-art";
import { cn } from "@/lib/utils";
import { saveEntryMedia, uploadEntryImage } from "../actions/entry";
import { errorText } from "./note-dialog";
import { shrink } from "./shrink-image";

/**
 * Admin → "Kirish ekranlari": tanishtiruv (3 ta), rol kartalari (2 ta) va bosh sahifadagi katta plitkalar (4 ta) rasmlari.
 * Har amal darhol saqlanadi
 * (audit jurnaliga tushadi) va saytda shu zahoti ko'rinadi; "O'rnatilgan tasvirga qaytish" — rasmni olib tashlaydi.
 */
export function EntryMediaEditor({ media: initial, canManage }: { media: EntryMedia; canManage: boolean }) {
  const { t } = useT();
  const router = useRouter();
  const [media, setMedia] = useState<EntryMedia>(initial);
  const [busy, setBusy] = useState<EntrySlot | null>(null);
  const [, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const uploadFor = useRef<EntrySlot | null>(null);

  const persist = (slot: EntrySlot, path: string | null) => {
    const next = { ...media, [slot]: path };
    setBusy(slot);
    start(async () => {
      const res = await callAction(() => saveEntryMedia(next));
      setBusy(null);
      if (!res.ok) {
        toast.error(errorText(t, res.error));
        return;
      }
      setMedia(next);
      toast.success(t("admin.entry.saved"));
      router.refresh();
    });
  };

  const onFile = async (file: File | undefined) => {
    const slot = uploadFor.current;
    if (!file || !slot) return;
    setBusy(slot);
    const form = new FormData();
    form.set("file", new File([await shrink(file)], "entry.jpg", { type: "image/jpeg" }));
    const res = await callAction(() => uploadEntryImage(form));
    if (!res.ok || !res.data) {
      setBusy(null);
      toast.error(errorText(t, res.ok ? "generic" : res.error));
      return;
    }
    persist(slot, res.data.path);
  };

  return (
    <div className="space-y-4">
      <p className="rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">{t("admin.entry.guide")}</p>
      {(Object.keys(SLOT_GROUPS) as (keyof typeof SLOT_GROUPS)[]).map((group) => (
        <section key={group} aria-labelledby={`entry-group-${group}`} className="space-y-3 pt-2">
          <div>
            <h2 id={`entry-group-${group}`} className="text-lg font-extrabold">
              {t(`admin.entry.group_${group}`)}
            </h2>
            <p className="text-sm text-muted-foreground">{t(`admin.entry.group_${group}_hint`)}</p>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {SLOT_GROUPS[group].map((slot) => {
              const spec = SLOT_SPEC[slot];
              const has = !!media[slot];
              return (
                <li key={slot} className="flex flex-col rounded-2xl border border-border/70 bg-card p-4 shadow-sm" data-testid={`entry-slot-${slot}`}>
                  <div
                    className={cn(
                      "overflow-hidden rounded-xl bg-primary-soft",
                      spec.ratio === "1:1" ? "mx-auto aspect-square w-40" : spec.ratio === "16:9" ? "aspect-[16/9] w-full" : "aspect-[4/3] w-full",
                    )}
                  >
                    <EntryImage slot={slot} media={media} sizes="320px" className="size-full" />
                  </div>
                  <div className="mt-3 flex items-start justify-between gap-2">
                    <h3 className="font-bold leading-snug">{t(`admin.entry.slot_${slot}`)}</h3>
                    {!has ? <Badge variant="outline">{t("admin.entry.builtin")}</Badge> : null}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{t("admin.entry.hint", { ratio: spec.ratio, size: spec.size })}</p>
                  <div className="mt-auto flex flex-wrap gap-2 pt-4">
                    <Button
                      type="button"
                      size="sm"
                      loading={busy === slot}
                      disabled={!canManage || busy !== null}
                      onClick={() => {
                        uploadFor.current = slot;
                        fileRef.current?.click();
                      }}
                    >
                      <ImagePlus className="size-4" /> {has ? t("admin.entry.replace") : t("admin.entry.upload")}
                    </Button>
                    {has ? (
                      <Button type="button" size="sm" variant="outline" disabled={!canManage || busy !== null} onClick={() => persist(slot, null)}>
                        <Undo2 className="size-4" /> {t("admin.entry.remove")}
                      </Button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        data-testid="entry-file"
        onChange={(e) => {
          void onFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </div>
  );
}
