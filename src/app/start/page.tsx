import { redirect } from "next/navigation";
import { getSession } from "@/features/auth/session";
import { entryPath, nextEntryStep } from "@/features/entry/flow";
import { getEntryState } from "@/features/entry/server";

export const metadata = { robots: { index: false } };

/**
 * Kirish oqimining "markazi": har qadamdan keyin shu yerga qaytiladi va keyingi kerakli ekran hal qilinadi
 * (features/entry/flow). Qaytgan foydalanuvchi — darhol o'z bosh sahifasiga; ?next= — oqim tugagach qaytiladigan joy.
 */
export default async function StartPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const [state, session, { next }] = await Promise.all([getEntryState(), getSession(), searchParams]);
  if (session?.profile.is_blocked) redirect("/blocked");
  redirect(entryPath(nextEntryStep(state), { mode: state.mode, employerOnboarded: !!session?.employerOnboarded, next }));
}
