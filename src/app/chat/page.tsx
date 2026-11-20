import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getT } from "@/lib/i18n/server";
import { getSession } from "@/features/auth/session";
import { getMode } from "@/features/mode/server";
import { Shell } from "@/components/shared/shell";
import { StartChat } from "@/features/start-chat/components/start-chat";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("easy.start_chat.title"), robots: { index: false } };
}

/**
 * /chat — asosiy ekran (pastki menyuning o'rtasi, "Izlash/E'lon"): kirgandan keyin shu yerga kelinadi (ega, 2026-11-20).
 * Suhbat rejimga qarab: ish izlovchiga — ish izlash / o'zi haqida e'lon, ish beruvchiga — ishchi izlash / vakansiya.
 * Mehmon ham ochadi (rejim tanlanmagan bo'lsa — ish izlovchi).
 */
export default async function ChatPage() {
  const [session, mode] = await Promise.all([getSession(), getMode()]);
  if (session?.profile.is_blocked) redirect("/blocked");
  const name = session?.profile.first_name?.trim() || null;
  return (
    <Shell>
      <StartChat name={name} mode={mode === "employer" ? "employer" : "worker"} />
    </Shell>
  );
}
