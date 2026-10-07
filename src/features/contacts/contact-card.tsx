import { Phone, Send, Lock } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { formatPhone } from "@/lib/format";
import { CopyButton } from "./copy-button";
import { RequestContactButton } from "./request-contact-button";

/**
 * Kontakt kartasi (server komponent). get_contact RPC orqali: ruxsat bo'lsa telefon/Telegram,
 * aks holda "Telefon ariza/taklif qabul qilingandan keyin ochiladi".
 */
export async function ContactCard({ profileId, hint }: { profileId: string; hint?: string }) {
  const { t } = await getT();
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_contact", { p_profile_id: profileId }).maybeSingle();

  if (!data?.allowed) {
    // Egasi "so'rov bo'yicha" ko'rsatadigan bo'lsa — so'rash tugmasi (yashirin raqam uchun tugma yo'q)
    const { data: status } = await supabase.rpc("contact_status_for", { p_owner: profileId });
    const canRequest = status === "none" || status === "pending" || status === "declined";
    return (
      <div className="space-y-3 rounded-2xl border border-dashed border-border bg-secondary/50 p-4 text-sm text-muted-foreground">
        <div className="flex items-start gap-3">
          <Lock className="mt-0.5 size-4 shrink-0" />
          <span>{canRequest ? t("contacts.request.hint") : (hint ?? t("common.contact_locked"))}</span>
        </div>
        {canRequest ? <RequestContactButton profileId={profileId} initial={status} /> : null}
      </div>
    );
  }
  return (
    <div className="space-y-3 rounded-2xl border border-success/30 bg-success-soft/40 p-4">
      <p className="text-sm font-semibold">{t("common.contact_title")}</p>
      {data.phone ? (
        <>
          {/* Asosiy harakat — bitta bosish bilan qo'ng'iroq */}
          <a
            href={`tel:${data.phone}`}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-success text-base font-semibold text-success-foreground shadow-sm transition-opacity hover:opacity-90"
          >
            <Phone className="size-5" /> {t("contacts.call")}
          </a>
          <div className="flex items-center justify-between gap-2">
            <span className="tabular text-[15px] font-semibold">{formatPhone(data.phone)}</span>
            <CopyButton value={data.phone} />
          </div>
        </>
      ) : null}
      {data.telegram_username ? (
        <a
          href={`https://t.me/${data.telegram_username}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-primary/40 bg-card text-[15px] font-semibold text-primary hover:bg-primary-soft/40"
        >
          <Send className="size-4" /> {t("contacts.write_telegram")}
        </a>
      ) : null}
      {!data.phone && !data.telegram_username ? <p className="text-sm text-muted-foreground">{t("contacts.no_contact")}</p> : null}
    </div>
  );
}
