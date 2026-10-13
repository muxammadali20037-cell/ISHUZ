"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { callAction } from "@/lib/action-call";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { WindowArtwork } from "@/features/home-windows/window-art";
import { chooseMode } from "../actions";
import type { AppMode } from "../mode";

/**
 * "Siz nima qidiryapsiz?" — ikkita katta rasmli tanlov. Tanlangach ilova shu rejimda ishlaydi (bosh sahifa, qidiruv,
 * saqlanganlar, e'lon berish); `next` berilsa — o'sha sahifaga o'tadi, aks holda joriy sahifa yangilanadi.
 */
export function ModeChooser({ next, heading = "h2", className }: { next?: Partial<Record<AppMode, string>>; heading?: "h1" | "h2" | null; className?: string }) {
  const { t } = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [picked, setPicked] = useState<AppMode | null>(null);

  const choose = (mode: AppMode) => {
    setPicked(mode);
    start(async () => {
      const res = await callAction(() => chooseMode(mode));
      if (!res.ok) {
        setPicked(null);
        toast.error(t("common.errors.generic"));
        return;
      }
      const to = next?.[mode];
      if (to) router.push(to);
      else router.refresh();
    });
  };

  const Heading = heading;
  const options = [
    { mode: "worker" as const, art: "jobs" as const, title: t("easy.mode.worker_title"), desc: t("easy.mode.worker_desc") },
    { mode: "employer" as const, art: "workers" as const, title: t("easy.mode.employer_title"), desc: t("easy.mode.employer_desc") },
  ];
  return (
    <section aria-labelledby={Heading ? "mode-chooser-title" : undefined} aria-label={Heading ? undefined : t("easy.mode.chooser_title")} className={cn("mx-auto max-w-3xl", className)}>
      {Heading ? (
        <div className="mb-4 text-center">
          <Heading id="mode-chooser-title" className="text-2xl font-extrabold tracking-tight sm:text-3xl">
            {t("easy.mode.chooser_title")}
          </Heading>
          <p className="mt-1 text-base text-muted-foreground sm:text-lg">{t("easy.mode.chooser_desc")}</p>
        </div>
      ) : null}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        {options.map((o) => (
          <button
            key={o.mode}
            type="button"
            disabled={pending}
            onClick={() => choose(o.mode)}
            data-track="mode_choose"
            data-track-to={o.mode}
            aria-busy={pending && picked === o.mode}
            className={cn(
              "press group flex flex-col overflow-hidden rounded-2xl border-2 bg-card text-left shadow-sm transition-colors hover:border-primary/60 disabled:opacity-70",
              picked === o.mode ? "border-primary" : "border-border",
            )}
          >
            <span className="block aspect-[3/2] w-full overflow-hidden bg-primary-soft sm:aspect-[16/9]" aria-hidden>
              <WindowArtwork art={o.art} />
            </span>
            <span className="flex flex-1 flex-col gap-1 p-3 sm:p-4">
              <span className="break-words text-lg font-extrabold leading-tight group-hover:text-primary sm:text-xl">{o.title}</span>
              <span className="break-words text-sm leading-snug text-muted-foreground sm:text-base">{o.desc}</span>
              <span className="mt-auto inline-flex items-center gap-1 pt-2 text-base font-bold text-primary">
                <ArrowRight className="size-5" aria-hidden />
              </span>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
