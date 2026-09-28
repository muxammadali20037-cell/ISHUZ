"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";
import { Dialog, Sheet } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { toast } from "@/components/ui/toast";
import { deleteMyAccount } from "@/features/auth/delete-account";

/** Hisobni o'chirish: nima bo'lishini aniq aytadi, tasdiq so'zini yozish shart */
export function DeleteAccount() {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [pending, startTransition] = useTransition();
  const word = t("profile.delete_account.word");
  const matches = confirm.trim().toUpperCase().replace(/[’‘`ʻʼ]/g, "'") === word.toUpperCase();

  const submit = () =>
    startTransition(async () => {
      const res = await deleteMyAccount({ confirm });
      if (res && !res.ok) {
        const key = `profile.delete_account.errors.${res.error}`;
        const msg = t(key);
        toast.error(msg === key ? t("common.errors.generic") : msg);
      }
    });

  return (
    <div className="border-t border-border pt-4">
      <p className="text-sm font-semibold">{t("profile.delete_account.title")}</p>
      <p className="mt-1 text-xs text-muted-foreground">{t("profile.delete_account.hint")}</p>
      <Button type="button" variant="ghost" size="sm" className="mt-2 text-destructive hover:bg-destructive-soft" onClick={() => setOpen(true)}>
        <Trash2 className="size-4" /> {t("profile.delete_account.button")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <Sheet
          title={t("profile.delete_account.title")}
          description={t("profile.delete_account.desc")}
          footer={
            <Button fullWidth variant="destructive" onClick={submit} loading={pending} disabled={!matches}>
              {t("profile.delete_account.confirm_button")}
            </Button>
          }
        >
          <ul className="mb-4 list-disc space-y-1 pl-5 text-sm text-foreground/85">
            <li>{t("profile.delete_account.what_1")}</li>
            <li>{t("profile.delete_account.what_2")}</li>
            <li>{t("profile.delete_account.what_3")}</li>
            <li>{t("profile.delete_account.what_4")}</li>
          </ul>
          <p className="mb-3 rounded-xl bg-secondary px-3 py-2 text-sm">{t("profile.delete_account.alternative")}</p>
          <Field label={t("profile.delete_account.type_word", { word })} htmlFor="delete-confirm">
            <Input id="delete-confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" placeholder={word} />
          </Field>
        </Sheet>
      </Dialog>
    </div>
  );
}
