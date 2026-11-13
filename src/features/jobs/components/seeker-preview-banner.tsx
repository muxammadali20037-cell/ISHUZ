import Link from "next/link";
import { Eye, Settings2 } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { Button } from "@/components/ui/button";
import { seekerVisibility } from "@/features/vacancies/seeker-view";
import type { VacancyDetail } from "../types";

/**
 * /jobs/[slug]?korinish=izlovchi — e'lon egasi o'z e'lonini ish izlovchi ko'zi bilan ko'rayotganini aytadi (tugmalar bu
 * ko'rinishda ishlamaydi) va boshqaruvga qaytaradi. E'lon hali ko'rinmasa — sababi (tekshiruvda, qoralama, to'xtatilgan…).
 */
export async function SeekerPreviewBanner({ vacancy }: { vacancy: VacancyDetail }) {
  const { t } = await getT();
  const visibility = seekerVisibility(vacancy);
  return (
    <div data-seeker-preview-banner={visibility} className="border-b border-primary/20 bg-primary-soft">
      <div className="container-app flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
        <Eye className="size-5 shrink-0 text-primary-ink" aria-hidden />
        <div className="min-w-0 flex-1 text-sm text-foreground">
          <p className="font-semibold">{t("jobs.seeker_preview.title")}</p>
          <p>{visibility === "visible" ? t("jobs.seeker_preview.desc") : t(`vacancies.seeker_view.status.${visibility}`)}</p>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link href={`/employer/vacancies/${vacancy.id}#korinish`}>
            <Settings2 className="size-4" aria-hidden /> {t("jobs.seeker_preview.back")}
          </Link>
        </Button>
      </div>
    </div>
  );
}
