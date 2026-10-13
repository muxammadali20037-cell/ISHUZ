"use client";

import Link from "next/link";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n/client";
import { callAction } from "@/lib/action-call";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { WindowArtwork } from "@/features/home-windows/window-art";
import { chooseMode } from "../actions";
import type { AppMode } from "../mode";

/**
 * Boshqa rejimning bo'limi ochilganda — ochiq tushuntirish va tanlov (avtomatik almashtirilmaydi):
 *  - "search": ish izlovchi ishchilar qidiruviga (yoki aksincha) kirdi → "o'tish" yoki o'z bo'limiga qaytish;
 *  - "post": e'lon berishdan oldin "Siz ish qidiryapsizmi?" / "Sizga xodim kerakmi?" — tasdiqlagandan keyin forma.
 */
export function ModeGate({ variant, need, otherHref }: { variant: "search" | "post"; need: AppMode; otherHref: string }) {
  const { t } = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const other: AppMode = need === "worker" ? "employer" : "worker";
  const k =
    variant === "post"
      ? need === "worker"
        ? { title: "post_worker_title", desc: "post_worker_desc", yes: "post_worker_yes", no: "post_worker_no" }
        : { title: "post_vacancy_title", desc: "post_vacancy_desc", yes: "post_vacancy_yes", no: "post_vacancy_no" }
      : need === "employer"
        ? { title: "gate_workers_title", desc: "gate_workers_desc", yes: "gate_to_employer", no: "gate_back_jobs" }
        : { title: "gate_jobs_title", desc: "gate_jobs_desc", yes: "gate_to_worker", no: "gate_back_workers" };

  const pick = (mode: AppMode, to?: string) =>
    start(async () => {
      const res = await callAction(() => chooseMode(mode));
      if (!res.ok) {
        toast.error(t("common.errors.generic"));
        return;
      }
      if (to) router.push(to);
      else router.refresh();
    });

  return (
    <div className="container-app py-6 sm:py-10">
      <section aria-labelledby="mode-gate-title" className="mx-auto max-w-lg overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="aspect-[16/9] w-full bg-primary-soft" aria-hidden>
          <WindowArtwork art={need === "worker" ? "jobs" : "workers"} />
        </div>
        <div className="space-y-3 p-5 sm:p-6">
          <h1 id="mode-gate-title" className="text-2xl font-extrabold leading-tight">
            {t(`easy.mode.${k.title}`)}
          </h1>
          <p className="text-base leading-snug text-muted-foreground">{t(`easy.mode.${k.desc}`)}</p>
          <div className="grid gap-2 pt-2">
            <Button type="button" size="xl" fullWidth className="h-14 text-lg" loading={pending} onClick={() => pick(need)}>
              {t(`easy.mode.${k.yes}`)}
            </Button>
            {variant === "post" ? (
              <Button type="button" size="xl" variant="outline" fullWidth className="h-14 text-lg" disabled={pending} onClick={() => pick(other, otherHref)}>
                {t(`easy.mode.${k.no}`)}
              </Button>
            ) : (
              <Button asChild size="xl" variant="outline" fullWidth className="h-14 text-lg">
                <Link href={otherHref}>{t(`easy.mode.${k.no}`)}</Link>
              </Button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
