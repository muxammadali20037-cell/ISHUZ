import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { safeInternalPath } from "@/lib/security/safe-path";
import { getMode } from "@/features/mode/server";
import { getEntryMedia } from "@/features/entry/queries";
import { EntryImage } from "@/features/entry/components/entry-art";
import { EntryBack, EntryHeading, EntryScreen } from "@/features/entry/components/entry-screen";
import { RolePicker } from "@/features/entry/components/role-picker";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("welcome.entry.role.title"), robots: { index: false } };
}

/**
 * 7-ekran: "O'z rolingizni tanlang". Kirishdan oldin (kirish usulidan keyin, raqamdan oldin) yoki kirgandan keyin
 * (masalan, Telegram'dan birinchi kirish) — tanlovdan so'ng `next` ga (oqim davom etadi).
 */
export default async function RolePage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const [{ t }, mode, media, sp] = await Promise.all([getT(), getMode(), getEntryMedia(), searchParams]);
  const next = safeInternalPath(sp.next, "") || "/start";
  // raqam ekraniga ketayotgan bo'lsa — orqaga kirish usuliga; aks holda bosh sahifaga
  const phoneNext = next.startsWith("/auth/telefon") ? new URLSearchParams(next.split("?")[1] ?? "").get("next") : null;
  const backHref = next.startsWith("/auth/telefon") ? `/auth?next=${encodeURIComponent(phoneNext || "/start")}` : "/";
  return (
    <EntryScreen left={<EntryBack href={backHref} label={t("common.actions.back")} />}>
      <EntryHeading className="pt-2" title={t("welcome.entry.role.title")} subtitle={t("welcome.entry.role.subtitle")} />
      {sp.error ? (
        <p className="mt-4 rounded-xl bg-destructive/10 p-3 text-center text-sm font-medium text-destructive" role="alert">
          {t("welcome.entry.role.error")}
        </p>
      ) : null}
      <RolePicker
        initial={mode}
        next={next}
        images={{
          worker: <EntryImage slot="role_worker" media={media} sizes="96px" className="size-full" />,
          employer: <EntryImage slot="role_employer" media={media} sizes="96px" className="size-full" />,
        }}
      />
    </EntryScreen>
  );
}
