import type { Metadata } from "next";
import { CheckCircle2, CircleAlert } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { getAdminContext } from "@/features/admin/context";
import { AdminPageHeader, Forbidden } from "@/features/admin/components/notes";
import { ChannelComposer } from "@/features/admin/components/channel-composer";
import { channelStatus } from "@/features/telegram-channel/channel";
import { CHANNEL_MEDIA } from "@/features/telegram-channel/media";

// video URL bo'yicha yuborilganda Telegram uni o'zi yuklab oladi — server amali uzoqroq kutadi
export const maxDuration = 60;

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: `${t("admin.nav.telegram")} · ${t("admin.shell.title")}` };
}

/** Rasmiy Telegram kanal: holat (bot adminmi) va post yuborish (matn + tayyor video/rasmlar) */
export default async function AdminTelegramChannelPage() {
  const ctx = await getAdminContext();
  const { t } = await getT();
  if (!ctx.can("notifications.broadcast")) return <Forbidden perm="notifications.broadcast" />;
  const status = await channelStatus();
  const ready = status.state === "ready";
  const name = "chatId" in status ? (status.title ? `${status.title} (${status.chatId})` : status.chatId) : null;

  return (
    <div>
      <AdminPageHeader title={t("admin.telegram.title")} subtitle={t("admin.telegram.subtitle")} />
      <section aria-labelledby="tg-status" className="mb-6 rounded-2xl border border-border/70 bg-card p-5 shadow-sm">
        <h2 id="tg-status" className="sr-only">
          {t("admin.telegram.status_title")}
        </h2>
        <div className="flex items-start gap-3">
          {ready ? <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" aria-hidden /> : <CircleAlert className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />}
          <div className="min-w-0 space-y-1">
            <p className="font-semibold">{t(`admin.telegram.state_${status.state}`, { channel: name ?? "", bot: "botUsername" in status && status.botUsername ? `@${status.botUsername}` : "" })}</p>
            {status.state === "not_admin" ? (
              <ol className="list-decimal space-y-0.5 pl-5 text-sm text-muted-foreground">
                <li>{t("admin.telegram.howto_1")}</li>
                <li>{t("admin.telegram.howto_2", { bot: status.botUsername ? `@${status.botUsername}` : "" })}</li>
                <li>{t("admin.telegram.howto_3")}</li>
              </ol>
            ) : null}
            {status.state === "no_channel" ? <p className="text-sm text-muted-foreground">{t("admin.telegram.no_channel_hint")}</p> : null}
            {status.state === "unreachable" && status.error ? <p className="text-sm text-muted-foreground">{status.error}</p> : null}
            {ready && !status.canPin ? <p className="text-sm text-muted-foreground">{t("admin.telegram.pin_hint")}</p> : null}
          </div>
        </div>
      </section>
      <ChannelComposer media={CHANNEL_MEDIA.map(({ id, kind, poster, files, duration, caption }) => ({ id, kind, poster, count: files.length, duration, caption }))} ready={ready} canPin={ready && status.canPin} />
    </div>
  );
}
