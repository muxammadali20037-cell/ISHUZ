import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import type { SessionContext } from "@/features/auth/session";

/**
 * Ish qidiruvchi dashboardi. To'liq versiyasi worker-flow modulida (features/worker) yoziladi:
 * "Siz uchun", "Yaqin atrofdagi ishlar", "Yangi vakansiyalar", kategoriyalar.
 */
export async function WorkerHome({ session }: { session: SessionContext }) {
  const { t } = await getT();
  return (
    <div className="container-app py-6">
      <h1 className="text-2xl font-bold">
        {t("common.nav.home")} — {session.profile.first_name} 👋
      </h1>
      <Link href="/jobs" className="mt-4 inline-block text-primary underline">
        {t("common.nav.jobs")}
      </Link>
    </div>
  );
}
