"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, ExternalLink, Images, Lightbulb, Pencil, Plus, Trash2 } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/misc";
import { deletePortfolioItem, movePortfolioItem } from "../../actions";
import type { WorkerPortfolioItem } from "../../queries";
import { MediaThumb } from "../media-thumb";
import { useAction } from "../use-action";
import { PortfolioDialog } from "./portfolio-dialog";

export function PortfolioManager({ items, userId, recommendedCategory }: { items: WorkerPortfolioItem[]; userId: string; recommendedCategory: string | null }) {
  const { t, tEnum } = useT();
  const { pending, run } = useAction();
  const [editing, setEditing] = useState<WorkerPortfolioItem | "new" | null>(null);
  const [deleting, setDeleting] = useState<WorkerPortfolioItem | null>(null);

  const move = (id: string, direction: "up" | "down") => run(() => movePortfolioItem({ id, direction }), { success: null });

  return (
    <div className="space-y-4">
      {recommendedCategory ? (
        <div className="flex items-start gap-3 rounded-2xl border border-warning/30 bg-warning-soft/60 p-4">
          <Lightbulb className="mt-0.5 size-5 shrink-0 text-warning" />
          <div className="text-sm">
            <p className="font-semibold">{t("profile.portfolio.recommended_title")}</p>
            <p className="mt-0.5 text-muted-foreground">{t("profile.portfolio.recommended_desc", { category: recommendedCategory })}</p>
          </div>
        </div>
      ) : null}

      <div className="flex justify-end">
        <Button type="button" onClick={() => setEditing("new")}>
          <Plus className="size-4" /> {t("profile.portfolio.add")}
        </Button>
      </div>

      {items.length === 0 ? (
        <EmptyState icon={Images} title={t("profile.portfolio.empty_title")} description={t("profile.portfolio.empty_desc")} action={{ label: t("profile.portfolio.add"), onClick: () => setEditing("new") }} />
      ) : (
        <ul className="space-y-3">
          {items.map((item, i) => {
            const first = item.media[0];
            return (
              <li key={item.id} className="flex gap-3 rounded-2xl border border-border/70 bg-card p-3 shadow-sm sm:p-4">
                <div className="size-20 shrink-0 overflow-hidden rounded-xl bg-secondary sm:size-24">
                  {first ? (
                    <MediaThumb path={first.path} url={first.url} alt={item.title} />
                  ) : (
                    <div className="flex size-full items-center justify-center text-muted-foreground">
                      <ExternalLink className="size-6" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{item.title}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                        <Badge variant="primary" size="sm">
                          {tEnum("portfolio_type", item.type)}
                        </Badge>
                        {item.media.length ? <span>{t("profile.portfolio.files_count", { count: item.media.length })}</span> : null}
                        {item.link_url ? (
                          <a href={item.link_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                            <ExternalLink className="size-3" /> {t("profile.portfolio.open_link")}
                          </a>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col gap-0.5 sm:flex-row">
                      <Button type="button" variant="ghost" size="icon-sm" aria-label={t("profile.portfolio.move_up")} disabled={pending || i === 0} onClick={() => move(item.id, "up")}>
                        <ArrowUp className="size-4" />
                      </Button>
                      <Button type="button" variant="ghost" size="icon-sm" aria-label={t("profile.portfolio.move_down")} disabled={pending || i === items.length - 1} onClick={() => move(item.id, "down")}>
                        <ArrowDown className="size-4" />
                      </Button>
                    </div>
                  </div>
                  {item.description ? <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">{item.description}</p> : null}
                  <div className="mt-2 flex gap-1.5">
                    <Button type="button" variant="outline" size="sm" onClick={() => setEditing(item)}>
                      <Pencil className="size-4" /> {t("common.actions.edit")}
                    </Button>
                    <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => setDeleting(item)}>
                      <Trash2 className="size-4" /> {t("common.actions.delete")}
                    </Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {editing ? <PortfolioDialog key={editing === "new" ? "new" : editing.id} item={editing === "new" ? null : editing} userId={userId} onClose={() => setEditing(null)} /> : null}

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={t("profile.portfolio.delete_title")}
        description={t("profile.portfolio.delete_desc")}
        confirmLabel={t("common.actions.delete")}
        cancelLabel={t("common.actions.cancel")}
        destructive
        loading={pending}
        onConfirm={() => {
          if (!deleting) return;
          const id = deleting.id;
          run(() => deletePortfolioItem({ id }), { success: t("profile.toast.deleted"), onSuccess: () => setDeleting(null) });
        }}
      />
    </div>
  );
}
