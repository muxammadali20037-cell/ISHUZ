import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { getAdminContext } from "@/features/admin/context";
import { AdminPageHeader, Forbidden } from "@/features/admin/components/notes";
import { HomeEditor } from "@/features/admin/components/home-editor";
import { parseWindows } from "@/features/home-windows/model";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: `${t("admin.nav.home")} · ${t("admin.shell.title")}` };
}

/** Bosh sahifa: tepadagi rasmli oynalar va "O'zingizga mosini toping" tugmasi (app_settings, 0060) */
export default async function AdminHomePage() {
  const ctx = await getAdminContext();
  const { t } = await getT();
  if (!ctx.can("settings.manage")) return <Forbidden perm="settings.manage" />;
  const supabase = await createClient();
  const { data } = await supabase.from("app_settings").select("key, value").in("key", ["home_banners", "ai_search_button"]);
  const map = new Map((data ?? []).map((r) => [r.key, r.value]));
  return (
    <div>
      <AdminPageHeader title={t("admin.home.title")} subtitle={t("admin.home.subtitle")} />
      <HomeEditor
        windows={parseWindows(map.get("home_banners"))}
        aiButton={map.get("ai_search_button") !== false}
        canManage={ctx.can("settings.manage")}
        ready={map.has("home_banners") && map.has("ai_search_button")}
      />
    </div>
  );
}
