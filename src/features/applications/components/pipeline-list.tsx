"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckSquare, ListChecks, X, XCircle } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { bulkSetApplicationStatus } from "../actions";
import { actionErrorText } from "../errors";
import type { EmployerApplicationItem } from "../types";
import { ApplicantCard } from "./applicant-card";
import { StatusSheet } from "./status-sheet";

const OPEN = new Set(["sent", "viewed", "shortlisted", "interview", "offered"]);

/** Nomzodlar ro'yxati + ommaviy tanlash: bir nechtasini birdan saralash yoki rad etish */
export function PipelineList({ items, canAct, vacancyId }: { items: EmployerApplicationItem[]; canAct: boolean; vacancyId: string }) {
  const { t } = useT();
  const router = useRouter();
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [rejectOpen, setRejectOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const selectable = items.filter((i) => OPEN.has(i.status));

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const stop = () => {
    setSelecting(false);
    setSelected(new Set());
  };

  const apply = (status: "shortlisted" | "rejected", note?: string) =>
    new Promise<boolean>((resolve) => {
      startTransition(async () => {
        const res = await bulkSetApplicationStatus({ vacancyId, ids: [...selected], status, note });
        if (!res.ok) {
          toast.error(actionErrorText(t, res.error));
          resolve(false);
          return;
        }
        const count = res.data?.count ?? 0;
        if (count > 0) toast.success(t("applications.bulk.done", { count }));
        else toast.info(t("applications.bulk.none"));
        stop();
        router.refresh();
        resolve(true);
      });
    });

  return (
    <div className="md:col-span-2">
      {canAct && selectable.length > 1 ? (
        <div className="mb-3 flex items-center justify-end gap-2">
          {selecting ? (
            <>
              <Button type="button" size="sm" variant="ghost" onClick={() => setSelected(new Set(selectable.map((i) => i.id)))}>
                {t("applications.bulk.select_all")}
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={stop}>
                <X className="size-4" /> {t("applications.bulk.cancel")}
              </Button>
            </>
          ) : (
            <Button type="button" size="sm" variant="outline" onClick={() => setSelecting(true)}>
              <CheckSquare className="size-4" /> {t("applications.bulk.select")}
            </Button>
          )}
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2">
        {items.map((item) => (
          <ApplicantCard
            key={item.id}
            item={item}
            canAct={canAct && !selecting}
            selection={selecting && OPEN.has(item.status) ? { selected: selected.has(item.id), onToggle: () => toggle(item.id) } : undefined}
            className={selecting && !OPEN.has(item.status) ? "opacity-50" : undefined}
          />
        ))}
      </div>

      {selecting && selected.size ? (
        <div className="sticky bottom-20 z-30 mt-4 flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card/95 p-3 shadow-lg backdrop-blur md:bottom-4">
          <span className="mr-auto text-sm font-semibold">{t("applications.bulk.selected", { count: selected.size })}</span>
          <Button type="button" size="sm" onClick={() => void apply("shortlisted")} loading={pending}>
            <ListChecks className="size-4" /> {t("applications.bulk.shortlist")}
          </Button>
          <Button type="button" size="sm" variant="destructive-soft" onClick={() => setRejectOpen(true)} disabled={pending}>
            <XCircle className="size-4" /> {t("applications.bulk.reject")}
          </Button>
        </div>
      ) : null}

      {rejectOpen ? (
        <StatusSheet
          status="rejected"
          open
          onOpenChange={setRejectOpen}
          pending={pending}
          onSubmit={async (note) => {
            const ok = await apply("rejected", note || undefined);
            if (ok) setRejectOpen(false);
            return ok;
          }}
        />
      ) : null}
    </div>
  );
}
