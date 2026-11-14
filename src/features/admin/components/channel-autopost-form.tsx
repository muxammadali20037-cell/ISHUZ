"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { callAction } from "@/lib/action-call";
import type { AutopostSettings } from "@/features/telegram-channel/autopost-settings";
import { saveChannelAutopost } from "../actions/telegram-channel";
import { errorText } from "./note-dialog";

/**
 * Admin → "Telegram kanal" → "Avtomatik e'lonlar": yangi vakansiyalar ("🟦 ISH") va ishchi e'lonlari ("🟩 ISHCHI") kanalga
 * o'zi tushadi. Har birini alohida yoqish va xohlasa — alohida kanal (masalan, ish beruvchilar uchun kanal).
 */
export function ChannelAutopostForm({ initial, canManage, mainChannel }: { initial: AutopostSettings; canManage: boolean; mainChannel: string | null }) {
  const { t } = useT();
  const router = useRouter();
  const [v, setV] = useState({ ...initial, jobsChat: initial.jobsChat ?? "", workersChat: initial.workersChat ?? "" });
  const [pending, start] = useTransition();

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const res = await callAction(() => saveChannelAutopost({ jobs: v.jobs, workers: v.workers, jobsChat: v.jobsChat.trim() || null, workersChat: v.workersChat.trim() || null }));
      if (!res.ok) {
        toast.error(res.error === "channel_invalid" ? t("admin.telegram.ap_channel_invalid") : errorText(t, res.error));
        return;
      }
      toast.success(t("admin.telegram.ap_saved"));
      router.refresh();
    });
  };

  const row = (key: "jobs" | "workers", chatKey: "jobsChat" | "workersChat") => (
    <div className="grid gap-2 rounded-xl border border-border p-3">
      <label className="flex min-h-11 items-center gap-2 font-semibold">
        <input
          type="checkbox"
          checked={v[key]}
          disabled={!canManage}
          onChange={(e) => setV((s) => ({ ...s, [key]: e.target.checked }))}
          className="size-5 accent-[var(--primary)]"
          data-autopost={key}
        />
        {t(`admin.telegram.ap_${key}`)}
      </label>
      <p className="text-sm text-muted-foreground">{t(`admin.telegram.ap_${key}_hint`)}</p>
      <label className="grid gap-1.5 text-sm font-medium">
        {t("admin.telegram.ap_chat")}
        <Input
          value={v[chatKey]}
          disabled={!canManage}
          maxLength={100}
          placeholder={mainChannel ?? "@kanal"}
          onChange={(e) => setV((s) => ({ ...s, [chatKey]: e.target.value }))}
        />
        <span className="text-xs font-normal text-muted-foreground">{t("admin.telegram.ap_chat_hint", { main: mainChannel ?? "—" })}</span>
      </label>
    </div>
  );

  return (
    <form onSubmit={save} aria-labelledby="tg-autopost" className="mb-6 grid gap-4 rounded-2xl border border-border/70 bg-card p-5 shadow-sm" data-autopost-form>
      <div>
        <h2 id="tg-autopost" className="text-lg font-extrabold">
          {t("admin.telegram.ap_title")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("admin.telegram.ap_desc")}</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {row("jobs", "jobsChat")}
        {row("workers", "workersChat")}
      </div>
      {canManage ? (
        <div>
          <Button type="submit" disabled={pending}>
            {t("admin.telegram.ap_save")}
          </Button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{t("admin.telegram.ap_readonly")}</p>
      )}
    </form>
  );
}
