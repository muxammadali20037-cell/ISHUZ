import Link from "next/link";
import { Briefcase, Eye, EyeOff, FileText, MapPin, Pencil, Star } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { fullName, initials } from "@/lib/format";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CategoryIcon } from "@/components/shared/category-icon";
import type { SessionContext } from "@/features/auth/session";
import type { WorkerProfileFull } from "../queries";
import { StatusSelector } from "./status-selector";

/** Profil sarlavha kartasi: rasm, ism, sarlavha, kasb, hudud, holat tanlovi, asosiy tugmalar */
export async function ProfileHeader({ session, data }: { session: SessionContext; data: WorkerProfileFull }) {
  const { t, tEnum, name } = await getT();
  const { worker } = data;
  const p = session.profile;
  const location = [name(worker.region), name(worker.district)].filter(Boolean).join(", ");

  return (
    <Card>
      <CardContent className="p-4 sm:p-6">
        <div className="flex items-start gap-4">
          <Avatar src={p.avatar_url} fallback={initials(p.first_name, p.last_name)} size="xl" className="ring-4 ring-primary-soft" />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-bold sm:text-2xl">{fullName(p.first_name, p.last_name) || t("profile.completeness.suggestions.add_name")}</h1>
            <p className={worker.headline ? "mt-0.5 text-[15px] text-foreground" : "mt-0.5 text-sm text-muted-foreground"}>{worker.headline ?? t("profile.view.no_headline")}</p>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <CategoryIcon name={worker.category?.icon} className="size-4" />
                {worker.category ? [name(worker.category), name(worker.subcategory)].filter(Boolean).join(" · ") : t("profile.view.no_category")}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="size-4" />
                {location || t("profile.view.no_location")}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Briefcase className="size-4" />
                {tEnum("experience_level", worker.experience_level)}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {worker.is_public ? (
                <Badge variant="success">
                  <Eye /> {t("profile.view.public_badge")}
                </Badge>
              ) : (
                <Badge variant="warning">
                  <EyeOff /> {t("profile.view.hidden_badge")}
                </Badge>
              )}
              {worker.views_count > 0 ? (
                <Badge>
                  <Star /> {t("profile.view.views", { count: worker.views_count })}
                </Badge>
              ) : null}
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:flex">
          <Button asChild>
            <Link href="/profile/edit">
              <Pencil className="size-4" /> {t("profile.view.edit")}
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/profile/cv">
              <FileText className="size-4" /> {t("profile.view.view_cv")}
            </Link>
          </Button>
        </div>

        <div className="mt-5 border-t border-border pt-4">
          <StatusSelector value={worker.status} />
        </div>
      </CardContent>
    </Card>
  );
}
