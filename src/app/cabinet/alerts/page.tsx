import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { requireSession } from "@/features/auth/session";
import { Shell } from "@/components/shared/shell";
import { createClient } from "@/lib/supabase/server";
import { getAlertSubscriptions } from "@/features/alerts/queries";
import { AlertSettings } from "@/features/alerts/components/alert-settings";
import { getMyActiveVacancies } from "@/features/cabinet/matches-queries";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("easy.alerts.title"), robots: { index: false } };
}

/** /cabinet/alerts — mos ish / ishchi haqida Telegram xabarnomalari (rozilik, rejim, filtrlar, to'xtatish) */
export default async function Page() {
  const session = await requireSession("/cabinet/alerts");
  const { t, name } = await getT();
  const supabase = await createClient();
  const [{ subs }, vacancies, { data: regions }, worker] = await Promise.all([
    getAlertSubscriptions(session),
    getMyActiveVacancies(session),
    supabase.from("regions").select("id, name_uz, name_ru, name_en, name_oz").order("sort_order"),
    session.workerId
      ? supabase.from("worker_profiles").select("profession_node_id, profession_nodes(id, name_uz, name_ru, name_en)").eq("id", session.workerId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const profession = worker.data?.profession_nodes ? { id: worker.data.profession_nodes.id, name: name(worker.data.profession_nodes) } : null;
  const regionOptions = (regions ?? []).map((r) => ({ id: r.id, name: name(r) }));
  const showWorker = !!session.workerId || !vacancies.length;
  const showEmployer = vacancies.length > 0 || !!session.employerId;
  return (
    <Shell>
      <div className="container-narrow space-y-6 py-6 text-lg sm:py-8">
        <div>
          <h1 className="text-3xl font-extrabold">{t("easy.alerts.title")}</h1>
          <p className="mt-2 text-muted-foreground">{t("easy.alerts.intro")}</p>
        </div>
        {showWorker ? <AlertSettings sub={subs.worker} regions={regionOptions} profession={profession} vacancies={[]} /> : null}
        {showEmployer ? <AlertSettings sub={subs.employer} regions={regionOptions} profession={null} vacancies={vacancies} /> : null}
        <p className="text-sm text-muted-foreground">{t("easy.alerts.privacy")}</p>
      </div>
    </Shell>
  );
}
