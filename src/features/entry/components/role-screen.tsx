import { getT } from "@/lib/i18n/server";
import type { AppMode } from "@/features/mode/mode";
import { getEntryMedia } from "../queries";
import { EntryImage } from "./entry-art";
import { EntryBack, EntryHeading, EntryScreen } from "./entry-screen";
import { RolePicker } from "./role-picker";

/**
 * 7-ekran: "O'z rolingizni tanlang". /start/rol va har kirishning birinchi qadami (/auth) — bitta ko'rinish.
 * Tanlovdan so'ng `next` ga (kirish usuli yoki oqimning keyingi qadami).
 */
export async function RoleScreen({ mode, next, backHref, error }: { mode: AppMode | null; next: string; backHref: string; error?: boolean }) {
  const [{ t }, media] = await Promise.all([getT(), getEntryMedia()]);
  return (
    <EntryScreen left={<EntryBack href={backHref} label={t("common.actions.back")} />}>
      <EntryHeading className="pt-2" title={t("welcome.entry.role.title")} subtitle={t("welcome.entry.role.subtitle")} />
      {error ? (
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
