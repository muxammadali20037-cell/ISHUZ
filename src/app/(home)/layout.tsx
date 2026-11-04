import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/features/auth/session";
import { getMode } from "@/features/mode/server";
import { entryPath, homeEntryStep } from "@/features/entry/flow";
import { getEntryState } from "@/features/entry/server";

/**
 * Bosh sahifa yo'naltirishlari — sahifadan (loading.tsx chegarasidan) yuqorida: shunda ular haqiqiy 307 bo'lib qoladi
 * (oqim boshlanib bo'lgandan keyingi "mijoz tomonidagi" yo'naltirish emas). Bloklangan — /blocked; birinchi ochilish (robot
 * emas) yoki tugallanmagan kirish oqimi — to'xtagan qadamiga (features/entry/flow).
 */
export default async function HomeLayout({ children }: { children: ReactNode }) {
  const [session, mode, entry] = await Promise.all([getSession(), getMode(), getEntryState()]);
  if (session?.profile.is_blocked) redirect("/blocked");
  const step = homeEntryStep(entry);
  if (step) redirect(entryPath(step, { mode }));
  return children;
}
