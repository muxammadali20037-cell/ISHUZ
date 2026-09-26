"use client";

import { useId, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Bookmark, FolderInput, StickyNote, Trash2, UserX, Plus } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { WorkerCard } from "@/components/shared/worker-card";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Dialog, Sheet, ConfirmDialog } from "@/components/ui/dialog";
import { RadioGroup, RadioItem } from "@/components/ui/checkbox";
import { Input, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { EmptyState } from "@/components/ui/misc";
import { toast } from "@/components/ui/toast";
import { moveSavedFolder, unsaveWorker, updateSavedNote } from "../actions";
import type { SavedWorkerItem } from "../types";
import { errorText } from "./error-text";

const ALL = "__all__";
const NONE = "__none__";

/** Saqlangan nomzodlar: papka chiplari, eslatma (inline), papkaga ko'chirish (Sheet), olib tashlash (Confirm) */
export function SavedWorkersList({ items: initial }: { items: SavedWorkerItem[] }) {
  const { t, locale } = useT();
  const [items, setItems] = useState(initial);
  // Server qayta yuborganida (revalidate) ro'yxatni sinxronlash — render vaqtida
  const [synced, setSynced] = useState(initial);
  if (synced !== initial) {
    setSynced(initial);
    setItems(initial);
  }
  const [folder, setFolder] = useState<string>(ALL);
  const [moving, setMoving] = useState<SavedWorkerItem | null>(null);
  const [removing, setRemoving] = useState<SavedWorkerItem | null>(null);
  const [removePending, startRemove] = useTransition();

  const folders = useMemo(() => [...new Set(items.map((i) => i.folder).filter((f): f is string => !!f))].sort((a, b) => a.localeCompare(b)), [items]);
  const hasNone = items.some((i) => !i.folder);
  const visible = items.filter((i) => folder === ALL || (folder === NONE ? !i.folder : i.folder === folder));

  const patchItem = (workerId: string, patch: Partial<SavedWorkerItem>) => setItems((list) => list.map((i) => (i.worker_id === workerId ? { ...i, ...patch } : i)));

  const confirmRemove = () => {
    const target = removing;
    if (!target) return;
    startRemove(async () => {
      const res = await unsaveWorker({ workerId: target.worker_id });
      if (!res.ok) {
        toast.error(errorText(t, res.error));
        return;
      }
      setItems((list) => list.filter((i) => i.worker_id !== target.worker_id));
      setRemoving(null);
      toast.success(t("workers.saved.removed"));
    });
  };

  if (!items.length) {
    return <EmptyState icon={Bookmark} title={t("workers.saved.empty_title")} description={t("workers.saved.empty_desc")} action={{ label: t("workers.saved.find"), href: "/workers" }} />;
  }

  return (
    <div>
      {folders.length ? (
        <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 scrollbar-none sm:mx-0 sm:flex-wrap sm:px-0">
          <Chip size="sm" selected={folder === ALL} onClick={() => setFolder(ALL)} className="shrink-0">
            {t("workers.saved.all")}
          </Chip>
          {folders.map((f) => (
            <Chip key={f} size="sm" selected={folder === f} onClick={() => setFolder(f)} className="shrink-0">
              {f}
            </Chip>
          ))}
          {hasNone ? (
            <Chip size="sm" selected={folder === NONE} onClick={() => setFolder(NONE)} className="shrink-0">
              {t("workers.saved.no_folder")}
            </Chip>
          ) : null}
        </div>
      ) : null}

      {!visible.length ? (
        <EmptyState icon={Bookmark} title={t("workers.saved.folder_empty")} action={{ label: t("workers.saved.all"), onClick: () => setFolder(ALL) }} />
      ) : (
        <ul className="space-y-3">
          {visible.map((item) => (
            <li key={item.worker_id} className="rounded-2xl border border-border/70 bg-card shadow-sm">
              {item.card ? (
                <WorkerCard worker={item.card} hideMatch className="rounded-b-none border-0 shadow-none" />
              ) : (
                <div className="flex items-center gap-3 p-4 text-sm text-muted-foreground">
                  <UserX className="size-5 shrink-0" />
                  {t("workers.saved.hidden_profile")}
                </div>
              )}
              <div className="border-t border-border/70 px-4 py-3">
                <NoteEditor item={item} onSaved={(note) => patchItem(item.worker_id, { note })} />
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span>{t("workers.saved.saved_at", { date: formatDate(item.created_at, locale) })}</span>
                  {item.folder ? (
                    <span className="inline-flex items-center gap-1 rounded-md bg-secondary px-1.5 py-0.5 font-medium text-foreground">
                      <FolderInput className="size-3" /> {item.folder}
                    </span>
                  ) : null}
                  <span className="ml-auto flex items-center gap-1">
                    <Button type="button" variant="ghost" size="sm" onClick={() => setMoving(item)}>
                      <FolderInput className="size-4" /> {t("workers.saved.move")}
                    </Button>
                    <Button type="button" variant="ghost" size="sm" className="text-destructive hover:bg-destructive-soft" onClick={() => setRemoving(item)}>
                      <Trash2 className="size-4" /> {t("workers.saved.remove")}
                    </Button>
                    {item.card ? (
                      <Button asChild variant="link" size="sm">
                        <Link href={`/workers/${item.worker_id}`}>{t("workers.saved.open")}</Link>
                      </Button>
                    ) : null}
                  </span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <MoveSheet item={moving} folders={folders} onClose={() => setMoving(null)} onMoved={(workerId, f) => patchItem(workerId, { folder: f })} />
      <ConfirmDialog
        open={!!removing}
        onOpenChange={(o) => (!o ? setRemoving(null) : undefined)}
        title={t("workers.saved.remove_confirm_title")}
        description={t("workers.saved.remove_confirm_desc", { name: removing?.card ? `${removing.card.first_name} ${removing.card.last_initial ?? ""}`.trim() : t("workers.meta.candidate_title") })}
        confirmLabel={t("workers.saved.remove")}
        cancelLabel={t("common.actions.cancel")}
        onConfirm={confirmRemove}
        destructive
        loading={removePending}
      />
    </div>
  );
}

function NoteEditor({ item, onSaved }: { item: SavedWorkerItem; onSaved: (note: string | null) => void }) {
  const { t } = useT();
  const id = useId();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(item.note ?? "");
  const [pending, startTransition] = useTransition();

  const save = () => {
    startTransition(async () => {
      const note = value.trim() || null;
      const res = await updateSavedNote({ workerId: item.worker_id, note });
      if (!res.ok) {
        toast.error(errorText(t, res.error));
        return;
      }
      onSaved(note);
      setEditing(false);
      toast.success(t("workers.saved.note_saved"));
    });
  };

  if (editing) {
    return (
      <div className="space-y-2">
        <label htmlFor={id} className="sr-only">
          {t("workers.saved.note_placeholder")}
        </label>
        <Textarea id={id} value={value} onChange={(e) => setValue(e.target.value)} placeholder={t("workers.saved.note_placeholder")} maxLength={1000} className="min-h-[72px]" autoFocus />
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setValue(item.note ?? "");
              setEditing(false);
            }}
          >
            {t("common.actions.cancel")}
          </Button>
          <Button type="button" size="sm" loading={pending} onClick={save}>
            {t("common.actions.save")}
          </Button>
        </div>
      </div>
    );
  }
  return (
    <button type="button" onClick={() => setEditing(true)} title={item.note ? t("workers.saved.note_edit") : t("workers.saved.note_add")} className={cn("flex w-full items-start gap-2 rounded-xl px-2 py-1.5 text-left text-sm transition-colors hover:bg-secondary", item.note ? "text-foreground" : "text-muted-foreground")}>
      <StickyNote className="mt-0.5 size-4 shrink-0 text-warning" />
      <span className="whitespace-pre-line">{item.note ?? t("workers.saved.note_add")}</span>
    </button>
  );
}

function MoveSheet({ item, folders, onClose, onMoved }: { item: SavedWorkerItem | null; folders: string[]; onClose: () => void; onMoved: (workerId: string, folder: string | null) => void }) {
  return (
    <Dialog open={!!item} onOpenChange={(o) => (!o ? onClose() : undefined)}>
      {item ? <MoveSheetBody key={item.worker_id} item={item} folders={folders} onClose={onClose} onMoved={onMoved} /> : null}
    </Dialog>
  );
}

function MoveSheetBody({ item, folders, onClose, onMoved }: { item: SavedWorkerItem; folders: string[]; onClose: () => void; onMoved: (workerId: string, folder: string | null) => void }) {
  const { t } = useT();
  const id = useId();
  const NEW = "__new__";
  const [choice, setChoice] = useState<string>(item.folder ?? NONE);
  const [newName, setNewName] = useState("");
  const [pending, startTransition] = useTransition();

  const submit = () => {
    const target = choice === NEW ? newName.trim() || null : choice === NONE ? null : choice;
    if (choice === NEW && !target) return;
    startTransition(async () => {
      const res = await moveSavedFolder({ workerId: item.worker_id, folder: target });
      if (!res.ok) {
        toast.error(errorText(t, res.error));
        return;
      }
      onMoved(item.worker_id, target);
      toast.success(t("workers.saved.moved"));
      onClose();
    });
  };

  return (
    <Sheet
      title={t("workers.saved.move_title")}
      description={t("workers.saved.move_desc")}
      footer={
        <Button type="button" fullWidth loading={pending} disabled={choice === NEW && !newName.trim()} onClick={submit}>
          {t("workers.saved.move")}
        </Button>
      }
    >
      <RadioGroup value={choice} onValueChange={setChoice} className="space-y-2">
        <RadioItem value={NONE} label={t("workers.saved.no_folder")} />
        {folders.map((f) => (
          <RadioItem key={f} value={f} label={f} />
        ))}
        <RadioItem
          value={NEW}
          label={
            <span className="inline-flex items-center gap-1.5">
              <Plus className="size-4" /> {t("workers.saved.new_folder")}
            </span>
          }
        />
      </RadioGroup>
      {choice === NEW ? (
        <Field htmlFor={id} className="mt-3">
          <Input id={id} value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={t("workers.saved.new_folder_placeholder")} maxLength={60} autoFocus />
        </Field>
      ) : null}
    </Sheet>
  );
}
