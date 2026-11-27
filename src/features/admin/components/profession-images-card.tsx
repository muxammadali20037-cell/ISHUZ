"use client";

import { ImagePlus, RefreshCw } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";
import { generateProfessionImagesBatch, regenerateProfessionImage } from "../actions/profession-images";
import { useAdminAction } from "./use-admin-action";

export interface ProfessionImageItem {
  nodeId: string;
  name: string;
  url: string;
}

/**
 * Kasb rasmlari (ega, 2026-11-27: "Kerak bo'lganda + tugma"): nechta tayyor, ommabop kasblarga oldindan yaratish (bir
 * bosishda bir nechta) va oxirgi rasmlar — yoqmagani "Almashtirish" bilan yangilanadi.
 */
export function ProfessionImagesCard({ ready, items, canManage }: { ready: number; items: ProfessionImageItem[]; canManage: boolean }) {
  const { t } = useT();
  const batch = useAdminAction();
  const one = useAdminAction();
  return (
    <section className="mb-6 rounded-2xl border border-border bg-card p-4 sm:p-5" data-admin-profession-images>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-bold">{t("admin.professions.images.title")}</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t("admin.professions.images.desc")}</p>
          <p className="mt-2 text-sm font-semibold" data-admin-profession-images-ready>
            {t("admin.professions.images.ready", { count: ready })}
          </p>
        </div>
        {canManage ? (
          <Button
            type="button"
            loading={batch.pending}
            disabled={one.pending}
            onClick={() => batch.run(() => generateProfessionImagesBatch(), { success: t("admin.professions.images.started") })}
            data-admin-profession-images-generate
          >
            <ImagePlus className="size-4" /> {t("admin.professions.images.generate")}
          </Button>
        ) : null}
      </div>
      {batch.pending ? <p className="mt-3 text-sm text-muted-foreground">{t("admin.professions.images.wait")}</p> : null}
      {items.length ? (
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((it) => (
            <li key={it.nodeId} className="min-w-0" data-admin-profession-image={it.nodeId}>
              {/* eslint-disable-next-line @next/next/no-img-element -- ochiq bucket'dagi tayyor rasm */}
              <img src={it.url} alt={it.name} width={300} height={200} loading="lazy" className="aspect-[3/2] w-full rounded-lg border border-border object-cover" />
              <div className="mt-1.5 flex items-center justify-between gap-2">
                <span className="min-w-0 truncate text-sm font-medium">{it.name}</span>
                {canManage ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    loading={one.pending}
                    disabled={batch.pending}
                    onClick={() => one.run(() => regenerateProfessionImage({ nodeId: it.nodeId }), { success: t("admin.professions.images.replaced") })}
                    aria-label={`${t("admin.professions.images.replace")}: ${it.name}`}
                  >
                    <RefreshCw className="size-4" />
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">{t("admin.professions.images.empty")}</p>
      )}
    </section>
  );
}
