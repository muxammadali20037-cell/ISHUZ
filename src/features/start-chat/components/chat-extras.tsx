import { getT } from "@/lib/i18n/server";
import { getServerEnv } from "@/lib/env";
import { socialLinks } from "@/lib/social";
import type { AppMode } from "@/features/mode/mode";
import { ChannelRow } from "@/features/landing/channel-row";
import { StoriesRow } from "@/features/stories/components/stories-row";

/** Chat sarlavhasi ustida — admin joylagan hikoyalar (faol hikoya bo'lmasa hech narsa chizilmaydi) */
export function ChatStories({ mode }: { mode: AppMode | null }) {
  return <StoriesRow mode={mode === "employer" ? "employer" : mode === "worker" ? "seeker" : null} />;
}

/**
 * Misollar ostida — "Telegram kanalimizga obuna bo'ling" (ega, 2026-11-21: "Telegram kanal qolsin"). Havola —
 * SOCIAL_TELEGRAM_URL; sozlanmagan bo'lsa — hech narsa.
 */
export async function ChatChannel() {
  const channel = socialLinks(getServerEnv()).find((l) => l.key === "telegram") ?? null;
  if (!channel) return null;
  const { t } = await getT();
  return (
    <ChannelRow
      href={channel.href}
      title={t("easy.home2.channel_title")}
      hint={t(channel.handle ? "easy.home2.channel_hint" : "easy.home2.channel_hint_plain", { handle: channel.handle ?? "" })}
    />
  );
}
