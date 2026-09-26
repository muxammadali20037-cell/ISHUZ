import { Phone, Send, Lock } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { formatPhone } from "@/lib/format";
import { CopyButton } from "./copy-button";

/**
 * Kontakt kartasi (server komponent). get_contact RPC orqali: ruxsat bo'lsa telefon/Telegram,
 * aks holda "Telefon ariza/taklif qabul qilingandan keyin ochiladi".
 */
export async function ContactCard({ profileId, hint }: { profileId: string; hint?: string }) {
  const { t } = await getT();
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_contact", { p_profile_id: profileId }).maybeSingle();

  if (!data?.allowed) {
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-dashed border-border bg-secondary/50 p-4 text-sm text-muted-foreground">
        <Lock className="mt-0.5 size-4 shrink-0" />
        <span>{hint ?? t("common.contact_locked")}</span>
      </div>
    );
  }
  return (
    <div className="space-y-2 rounded-2xl border border-success/30 bg-success-soft/40 p-4">
      <p className="text-sm font-semibold">{t("common.contact_title")}</p>
      {data.phone ? (
        <div className="flex items-center justify-between gap-2">
          <a href={`tel:${data.phone}`} className="inline-flex items-center gap-2 text-[15px] font-semibold text-foreground">
            <Phone className="size-4 text-success" /> {formatPhone(data.phone)}
          </a>
          <CopyButton value={data.phone} />
        </div>
      ) : null}
      {data.telegram_username ? (
        <a
          href={`https://t.me/${data.telegram_username}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-[15px] font-semibold text-primary"
        >
          <Send className="size-4" /> @{data.telegram_username}
        </a>
      ) : null}
    </div>
  );
}
