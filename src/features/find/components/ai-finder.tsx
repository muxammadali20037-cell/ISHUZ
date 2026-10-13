"use client";

import Link from "next/link";
import { useRef, useState, useTransition, type MouseEvent } from "react";
import { ArrowRight, BriefcaseBusiness, Loader2, Search, Sparkles, UsersRound } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { callAction } from "@/lib/action-call";
import { Button } from "@/components/ui/button";
import { Dialog, Sheet } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { aiFind, type AiFindResult } from "../ai-find";
import { JobResultCard, WorkerResultCard } from "./result-cards";

/**
 * O'ng pastdagi doimiy lupa tugmasi — "O'zingizga mosini toping": foydalanuvchi qisqa yozadi, server matnni tahlil qiladi
 * (lug'at, kerak bo'lsa sun'iy intellekt) va bazadagi mos e'lonlarni saralab qaytaradi — natija shu oynada, ilova ichida.
 * Tugma pastki menyu va yopishqoq amallar paneli ustida turadi (globals.css: .ai-fab, --cta-offset).
 */
/** `locked` — rejim tanlangan: faqat shu rejim ichida qidiradi (ish izlovchi ishchilarni qidirmaydi) */
export function AiFinder({ defaultMode, locked = false }: { defaultMode: "jobs" | "workers"; locked?: boolean }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState(defaultMode);
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  const [result, setResult] = useState<AiFindResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const errorText = (code: string) => {
    for (const key of [`easy.finder.errors.${code}`, `common.errors.${code}`]) {
      const v = t(key);
      if (v !== key) return v;
    }
    return t("common.errors.generic");
  };

  const submit = (query = text) => {
    const q = query.trim();
    if (q.length < 2) {
      inputRef.current?.focus();
      return;
    }
    setText(q);
    setError(null);
    start(async () => {
      const res = await callAction(() => aiFind({ text: q, mode }));
      if (res.ok && res.data) setResult(res.data);
      else {
        setResult(null);
        setError(errorText(res.ok ? "generic" : res.error));
      }
    });
  };

  // natijadagi havola bosilsa — oyna yopiladi (sahifa ochiladi)
  const closeOnLink = (e: MouseEvent) => {
    if (e.target instanceof Element && e.target.closest("a[href^='/']")) setOpen(false);
  };

  const examples = mode === "workers" ? [t("easy.finder.example_w1"), t("easy.finder.example_w2"), t("easy.finder.example_w3")] : [t("easy.finder.example_j1"), t("easy.finder.example_j2"), t("easy.finder.example_j3")];
  const count = result ? result.jobs.length + result.workers.length : 0;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("easy.finder.button")}
        data-track="ai_finder_open"
        className="ai-fab press fixed right-4 z-30 flex size-14 items-center justify-center gap-2 rounded-full bg-primary text-primary-foreground shadow-lg ring-4 ring-background hover:bg-primary-hover md:right-6 md:size-auto md:h-14 md:px-5"
      >
        <span className="relative" aria-hidden>
          <Search className="size-7" strokeWidth={2.5} />
          <Sparkles className="absolute -right-2 -top-2 size-4" />
        </span>
        <span className="hidden text-base font-bold md:inline">{t("easy.finder.button")}</span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <Sheet title={t("easy.finder.title")} description={t("easy.finder.desc")} onOpenAutoFocus={(e) => (e.preventDefault(), inputRef.current?.focus())}>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            {locked ? (
              <p className="inline-flex items-center gap-2 rounded-full bg-primary-soft px-3 py-1.5 text-sm font-semibold text-primary">
                {mode === "workers" ? <UsersRound className="size-4" aria-hidden /> : <BriefcaseBusiness className="size-4" aria-hidden />}
                {mode === "workers" ? t("easy.mode.finder_in_workers") : t("easy.mode.finder_in_jobs")}
              </p>
            ) : (
            <div role="radiogroup" aria-label={t("easy.finder.mode_label")} className="grid grid-cols-2 gap-2">
              {(
                [
                  ["jobs", BriefcaseBusiness, t("easy.finder.mode_jobs")],
                  ["workers", UsersRound, t("easy.finder.mode_workers")],
                ] as const
              ).map(([m, Icon, label]) => (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={mode === m}
                  onClick={() => {
                    setMode(m);
                    setResult(null);
                  }}
                  className={cn(
                    "flex min-h-12 items-center justify-center gap-2 rounded-xl border-2 px-3 text-base font-semibold",
                    mode === m ? "border-primary bg-primary-soft text-foreground" : "border-border bg-card text-muted-foreground hover:border-primary/50",
                  )}
                >
                  <Icon className="size-5 shrink-0" aria-hidden /> {label}
                </button>
              ))}
            </div>
            )}
            <label htmlFor="ai-finder-text" className="block text-lg font-semibold">
              {t("easy.finder.label")}
            </label>
            <Textarea
              ref={inputRef}
              id="ai-finder-text"
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, 300))}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
              rows={2}
              maxLength={300}
              placeholder={mode === "workers" ? t("easy.finder.placeholder_workers") : t("easy.finder.placeholder_jobs")}
              className="min-h-20 rounded-2xl text-lg"
            />
            <div className="flex flex-wrap gap-2">
              {examples.map((ex) => (
                <button key={ex} type="button" onClick={() => submit(ex)} className="inline-flex min-h-10 items-center rounded-full border border-primary/40 bg-primary-soft/50 px-3 text-base font-semibold text-primary hover:bg-primary-soft">
                  «{ex}»
                </button>
              ))}
            </div>
            <Button type="submit" size="xl" fullWidth className="h-14 text-lg" loading={pending}>
              {pending ? t("easy.finder.analyzing") : t("easy.finder.submit")} {pending ? null : <Search className="size-5" aria-hidden />}
            </Button>
          </form>

          <div aria-live="polite" className="mt-5 space-y-4" onClick={closeOnLink}>
            {error ? <p className="rounded-2xl border border-destructive/40 bg-destructive-soft px-4 py-3 text-base text-destructive">{error}</p> : null}
            {pending && !result ? (
              <p className="flex items-center gap-2 text-base text-muted-foreground">
                <Loader2 className="size-5 animate-spin" aria-hidden /> {t("easy.finder.analyzing")}
              </p>
            ) : null}
            {result ? (
              <>
                <div className="rounded-2xl bg-secondary px-4 py-3">
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
                    <Sparkles className="size-4 text-primary" aria-hidden /> {result.source === "ai" ? t("easy.finder.by_ai") : t("easy.finder.by_rules")}
                  </p>
                  <p className="mt-1 text-base font-semibold">
                    {t("easy.finder.understood")} {result.understood.join(" · ")}
                  </p>
                </div>
                {result.needProfession ? (
                  <div className="space-y-3 rounded-2xl border-2 border-dashed border-border p-4 text-center">
                    <p className="text-lg font-bold">{t("easy.finder.need_profession")}</p>
                    <p className="text-base text-muted-foreground">{t("easy.finder.need_profession_desc")}</p>
                    <Button asChild variant="outline" className="h-12 text-base">
                      <Link href={result.href}>{t("easy.finder.pick_from_list")}</Link>
                    </Button>
                  </div>
                ) : count ? (
                  <>
                    <p className="text-base font-semibold text-muted-foreground">
                      {result.mode === "workers" ? t("easy.finder.found_workers", { count: result.total }) : t("easy.finder.found_jobs", { count: result.total })}
                    </p>
                    <ul className="grid grid-cols-1 gap-3">
                      {result.jobs.map((job) => (
                        <li key={job.id}>
                          <JobResultCard job={job} imageUrl={job.profession_node_id ? result.images[job.profession_node_id] : null} photoPath={result.photos[job.id] ?? null} saved={result.saved.includes(job.id)} />
                        </li>
                      ))}
                      {result.workers.map((w) => (
                        <li key={w.id}>
                          <WorkerResultCard worker={w} imageUrl={w.profession_node_id ? result.images[w.profession_node_id] : null} saved={result.saved.includes(w.id)} />
                        </li>
                      ))}
                    </ul>
                    {result.total > count ? (
                      <Button asChild size="xl" fullWidth className="h-14 text-lg">
                        <Link href={result.href}>
                          {t("easy.finder.show_all", { count: result.total })} <ArrowRight className="size-5" aria-hidden />
                        </Link>
                      </Button>
                    ) : null}
                  </>
                ) : (
                  <div className="space-y-2 rounded-2xl border-2 border-dashed border-border p-4 text-center">
                    <p className="text-lg font-bold">{result.mode === "workers" ? t("easy.finder.empty_workers") : t("easy.finder.empty_jobs")}</p>
                    <p className="text-base text-muted-foreground">{t("easy.finder.empty_desc")}</p>
                  </div>
                )}
              </>
            ) : null}
          </div>
        </Sheet>
      </Dialog>
    </>
  );
}
