import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { getAdminContext } from "@/features/admin/context";
import { AdminPageHeader, Forbidden } from "@/features/admin/components/notes";
import { EntryMediaEditor } from "@/features/admin/components/entry-media-editor";
import { ENTRY_MEDIA_KEY, parseEntryMedia } from "@/features/entry/media";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: `${t("admin.nav.entry")} · ${t("admin.shell.title")}` };
}

/** Kirish ekranlari: tanishtiruv va rol kartalari rasmlari (app_settings.entry_media) */
export default async function AdminEntryPage() {
  const ctx = await getAdminContext();
  const { t } = await getT();
  if (!ctx.can("settings.manage")) return <Forbidden perm="settings.manage" />;
  const supabase = await createClient();
  const { data } = await supabase.from("app_settings").select("value").eq("key", ENTRY_MEDIA_KEY).maybeSingle();
  return (
    <div>
      <AdminPageHeader title={t("admin.entry.title")} subtitle={t("admin.entry.subtitle")} />
      <EntryMediaEditor media={parseEntryMedia(data?.value ?? null)} canManage={ctx.can("settings.manage")} />
    </div>
  );
}
