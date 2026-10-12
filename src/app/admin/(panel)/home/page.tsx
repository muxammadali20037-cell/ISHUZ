import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { LOCALES } from "@/lib/i18n/config";
import { messages } from "@/lib/i18n/messages";
import { createClient } from "@/lib/supabase/server";
import { getAdminContext } from "@/features/admin/context";
import { AdminPageHeader, Forbidden } from "@/features/admin/components/notes";
import { HomeEditor, type WindowDefaults } from "@/features/admin/components/home-editor";
import { WINDOW_ART, parseWindows } from "@/features/home-windows/model";

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
  // standart oynalar matni barcha tillarda (admin interfeysi faqat o'z tilini yuklaydi)
  const defaults = Object.fromEntries(
    WINDOW_ART.map((id) => [id, Object.fromEntries(LOCALES.map((l) => [l, messages[l].easy.home.windows[id]]))]),
  ) as WindowDefaults;
  return (
    <div>
      <AdminPageHeader title={t("admin.home.title")} subtitle={t("admin.home.subtitle")} />
      <HomeEditor
        windows={parseWindows(map.get("home_banners"))}
        defaults={defaults}
        aiButton={map.get("ai_search_button") !== false}
        canManage={ctx.can("settings.manage")}
        ready={map.has("home_banners") && map.has("ai_search_button")}
      />
    </div>
  );
}
