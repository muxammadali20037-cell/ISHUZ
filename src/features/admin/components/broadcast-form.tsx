"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Megaphone } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { RadioGroup, RadioItem } from "@/components/ui/checkbox";
import { ConfirmDialog } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import { broadcastSchema, type BroadcastInput } from "../schema";
import { sendBroadcast } from "../actions/notifications";
import { errorText } from "./note-dialog";

/** Ommaviy bildirishnoma formasi → ConfirmDialog (taxminiy qabul qiluvchilar) → rpc admin_broadcast */
export function BroadcastForm({ recipients }: { recipients: { all: number; worker: number; employer: number } }) {
  const { t } = useT();
  const router = useRouter();
  const [form, setForm] = useState<BroadcastInput>({ title: "", body: "", role: "all", link: "" });
  const [errors, setErrors] = useState<Partial<Record<keyof BroadcastInput, string>>>({});
  const [confirm, setConfirm] = useState(false);
  const [pending, startTransition] = useTransition();
  const estimated = recipients[form.role];

  const validate = () => {
    const parsed = broadcastSchema.safeParse(form);
    if (parsed.success) {
      setErrors({});
      return true;
    }
    const next: Partial<Record<keyof BroadcastInput, string>> = {};
    for (const issue of parsed.error.issues) {
      const k = issue.path[0];
      if (typeof k === "string" && !(k in next)) next[k as keyof BroadcastInput] = k === "link" ? t("admin.notifications.link_hint") : t("common.errors.validation");
    }
    setErrors(next);
    return false;
  };

  const send = () => {
    startTransition(async () => {
      const res = await sendBroadcast(form);
      setConfirm(false);
      if (!res.ok) {
        toast.error(errorText(t, res.error));
        return;
      }
      toast.success(t("admin.notifications.sent", { count: res.data?.count ?? 0 }));
      setForm({ title: "", body: "", role: "all", link: "" });
      router.refresh();
    });
  };

  return (
    <form
      className="space-y-4 rounded-2xl border border-border/70 bg-card p-5 shadow-sm"
      onSubmit={(e) => {
        e.preventDefault();
        if (validate()) setConfirm(true);
      }}
    >
      <Field label={t("admin.notifications.field_title")} htmlFor="bc-title" required error={errors.title}>
        <Input id="bc-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={120} invalid={!!errors.title} />
      </Field>
      <Field label={t("admin.notifications.field_body")} htmlFor="bc-body" required error={errors.body}>
        <Textarea id="bc-body" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} maxLength={2000} invalid={!!errors.body} />
      </Field>
      <Field label={t("admin.notifications.field_role")}>
        <RadioGroup value={form.role} onValueChange={(v) => setForm({ ...form, role: v as BroadcastInput["role"] })} className="grid gap-2 sm:grid-cols-3">
          <RadioItem value="all" label={t("admin.notifications.role_all")} description={t("admin.notifications.recipients_count", { count: recipients.all })} />
          <RadioItem value="worker" label={t("common.role.worker")} description={t("admin.notifications.recipients_count", { count: recipients.worker })} />
          <RadioItem value="employer" label={t("common.role.employer")} description={t("admin.notifications.recipients_count", { count: recipients.employer })} />
        </RadioGroup>
      </Field>
      <Field label={t("admin.notifications.field_link")} htmlFor="bc-link" hint={t("common.labels.optional")} error={errors.link} description={t("admin.notifications.link_hint")}>
        <Input id="bc-link" value={form.link ?? ""} onChange={(e) => setForm({ ...form, link: e.target.value })} placeholder="/jobs" maxLength={300} invalid={!!errors.link} />
      </Field>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{t("admin.notifications.estimated", { count: estimated })}</p>
        <Button type="submit" loading={pending}>
          <Megaphone className="size-4" />
          {t("admin.notifications.send")}
        </Button>
      </div>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={t("admin.notifications.confirm_title")}
        description={t("admin.notifications.confirm_desc", { count: estimated, title: form.title })}
        confirmLabel={t("admin.notifications.send")}
        cancelLabel={t("common.actions.cancel")}
        onConfirm={send}
        loading={pending}
      />
    </form>
  );
}
