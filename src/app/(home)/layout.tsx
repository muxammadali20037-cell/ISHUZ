import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/features/auth/session";
import { getMode } from "@/features/mode/server";
import { CHAT_PATH, entryPath, homeEntryStep } from "@/features/entry/flow";
import { getEntryState } from "@/features/entry/server";

/**
 * Bosh sahifa yo'naltirishlari — sahifadan (loading.tsx chegarasidan) yuqorida: shunda ular haqiqiy 307 bo'lib qoladi
 * (oqim boshlanib bo'lgandan keyingi "mijoz tomonidagi" yo'naltirish emas). Bloklangan — /blocked; birinchi ochilish (robot
 * emas) yoki tugallanmagan kirish oqimi — to'xtagan qadamiga (features/entry/flow); kirgan foydalanuvchi — chat (/chat).
 * Mehmon uchun "/" — avvalgidek ochiq bosh sahifa (qidiruv tizimlari ham shuni ko'radi).
 */
export default async function HomeLayout({ children }: { children: ReactNode }) {
  const [session, mode, entry] = await Promise.all([getSession(), getMode(), getEntryState()]);
  if (session?.profile.is_blocked) redirect("/blocked");
  const step = homeEntryStep(entry);
  if (step) redirect(entryPath(step, { mode }));
  // kirgan foydalanuvchining asosiy ekrani — chat (2026-11-20): logotip, ilova belgisi va Telegram ilovasi "/" ni ochadi
  if (session) redirect(CHAT_PATH);
  return children;
}
