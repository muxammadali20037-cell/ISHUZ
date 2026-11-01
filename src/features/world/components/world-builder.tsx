"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Bell, Check, ChevronLeft, FileUser, MapPin, Sparkles } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Stepper } from "@/components/ui/misc";
import { toast } from "@/components/ui/toast";
import { CategoryIcon } from "@/components/shared/category-icon";
import { callAction } from "@/lib/action-call";
import { useTelegram } from "@/lib/telegram/provider";
import { saveWorld } from "../actions";

export interface WorldCategory {
  id: string;
  name: string;
  icon: string | null;
  /** faol vakansiyalar soni (bazadan); noma'lum — null */
  count: number | null;
}

const MAX = 8;
const num = (n: number) => new Intl.NumberFormat("ru-RU").format(n);

/**
 * "Dunyongizni yarating" (2026-11, "Outreach" uslubi): 1) qiziqqan sohalar (1–8) → 2) hudud → 3) "Dunyongiz tayyor!" — tanlov
 * xulosasi, shu sohalardagi haqiqiy faol vakansiyalar soni va keyingi qadamlar (CV, Telegram xabarlari). Saqlash 2-qadam oxirida.
 * Telefon, kompyuter va Telegram ichida bir xil ishlaydi (Telegram'da — muvaffaqiyatda qisqa tebranish).
 */
export function WorldBuilder({
  categories,
  regions,
  initial,
  initialRegion,
  hasCv,
  hasTelegram,
}: {
  categories: WorldCategory[];
  regions: { slug: string; name: string }[];
  initial: string[];
  initialRegion: string | null;
  hasCv: boolean;
  hasTelegram: boolean;
}) {
  const { t } = useT();
  const router = useRouter();
  const { notify } = useTelegram();
  const [step, setStep] = useState(1);
  const [picked, setPicked] = useState<string[]>(initial);
  const [region, setRegion] = useState<string>(initialRegion ?? "all");
  const [pending, start] = useTransition();

  const toggle = (id: string) =>
    setPicked((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : cur.length >= MAX ? (toast.info(t("easy.world.max", { max: MAX })), cur) : [...cur, id]));

  const save = () =>
    start(async () => {
      const res = await callAction(() => saveWorld({ categories: picked, region }));
      if (res.ok) {
        notify("success");
        setStep(3);
        router.refresh();
        return;
      }
      if (res.error === "not_authenticated") {
        router.push(`/auth?next=${encodeURIComponent("/dunyo")}`);
        return;
      }
      toast.error(t(res.error === "unavailable" ? "world.unavailable" : "common.errors.generic"));
    });

  const chosen = categories.filter((c) => picked.includes(c.id));
  const total = chosen.reduce((a, c) => a + (c.count ?? 0), 0);
  const regionName = region === "all" ? t("easy.world.region_all") : (regions.find((r) => r.slug === region)?.name ?? t("easy.world.region_all"));

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 pb-6 pt-4 sm:px-6 sm:pt-8">
      <div className="flex items-center justify-between gap-2">
        {step === 2 ? (
          <button type="button" onClick={() => setStep(1)} aria-label={t("common.actions.back")} className="inline-flex size-11 items-center justify-center rounded-xl hover:bg-secondary">
            <ChevronLeft className="size-6" aria-hidden />
          </button>
        ) : (
          <Link href="/" aria-label={t("common.actions.back")} className="inline-flex size-11 items-center justify-center rounded-xl hover:bg-secondary">
            <ChevronLeft className="size-6" aria-hidden />
          </Link>
        )}
        {step < 3 ? (
          <Link href="/" className="inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground">
            {t("easy.world.skip")}
          </Link>
        ) : null}
      </div>

      <Stepper centered current={step} total={3} label={t("easy.world.step")} className="mt-2" />

      {step === 1 ? (
        <section aria-labelledby="world-title" className="mt-6 flex flex-1 flex-col sm:mt-8">
          <div className="text-center">
            <h1 id="world-title" className="text-2xl font-extrabold leading-tight tracking-tight sm:text-3xl">
              {t("easy.world.interests_title")}
            </h1>
            <p className="mx-auto mt-2 max-w-md text-base text-muted-foreground">{t("easy.world.interests_subtitle", { max: MAX })}</p>
          </div>
          <fieldset className="mt-6">
            <legend className="sr-only">{t("easy.world.interests_title")}</legend>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {categories.map((c) => {
                const on = picked.includes(c.id);
                return (
                  <li key={c.id} className="flex">
                    <label
                      className={cn(
                        "press relative flex w-full cursor-pointer flex-col items-center rounded-2xl border-2 bg-card px-2 pb-3.5 pt-8 text-center transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
                        on ? "border-primary bg-primary-soft" : "border-border hover:border-primary/40",
                      )}
                    >
                      <input type="checkbox" className="sr-only" checked={on} onChange={() => toggle(c.id)} />
                      <span
                        className={cn("absolute left-2.5 top-2.5 flex size-5 items-center justify-center rounded-md border", on ? "border-primary bg-primary text-primary-foreground" : "border-input bg-card")}
                        aria-hidden
                      >
                        {on ? <Check className="size-3.5" strokeWidth={3} /> : null}
                      </span>
                      <span className={cn("flex size-12 items-center justify-center rounded-2xl text-primary", on ? "bg-card" : "bg-primary-soft")} aria-hidden>
                        <CategoryIcon name={c.icon} className="size-6" />
                      </span>
                      <span className="mt-2.5 text-sm font-semibold leading-tight">{c.name}</span>
                      {c.count ? <span className="mt-1 text-xs text-muted-foreground">{t("easy.world.jobs_count", { count: num(c.count) })}</span> : null}
                    </label>
                  </li>
                );
              })}
            </ul>
          </fieldset>
          <Footer>
            <p className="text-sm font-semibold text-muted-foreground" aria-live="polite">
              {t("easy.world.picked", { count: picked.length, max: MAX })}
            </p>
            <Button size="lg" disabled={!picked.length} onClick={() => setStep(2)} className="min-w-40">
              {t("common.actions.next")} <ArrowRight className="size-5" />
            </Button>
          </Footer>
        </section>
      ) : step === 2 ? (
        <section aria-labelledby="world-region-title" className="mt-6 flex flex-1 flex-col sm:mt-8">
          <div className="text-center">
            <h1 id="world-region-title" className="text-2xl font-extrabold leading-tight tracking-tight sm:text-3xl">
              {t("easy.world.region_title")}
            </h1>
            <p className="mx-auto mt-2 max-w-md text-base text-muted-foreground">{t("easy.world.region_subtitle")}</p>
          </div>
          <fieldset className="mt-6">
            <legend className="sr-only">{t("easy.world.region_title")}</legend>
            <ul className="grid grid-cols-1 gap-2 min-[400px]:grid-cols-2 sm:grid-cols-3">
              {[{ slug: "all", name: t("easy.world.region_all") }, ...regions].map((r) => {
                const on = region === r.slug;
                return (
                  <li key={r.slug} className="flex">
                    <label
                      className={cn(
                        "press flex min-h-12 w-full cursor-pointer items-center gap-2.5 rounded-xl border-2 bg-card px-3 text-left text-sm font-semibold transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
                        on ? "border-primary bg-primary-soft" : "border-border hover:border-primary/40",
                      )}
                    >
                      <input type="radio" name="world-region" className="sr-only" checked={on} onChange={() => setRegion(r.slug)} />
                      <MapPin className={cn("size-4 shrink-0", on ? "text-primary" : "text-muted-foreground")} aria-hidden />
                      <span className="min-w-0 flex-1 leading-tight">{r.name}</span>
                      {on ? <Check className="size-4 shrink-0 text-primary" strokeWidth={3} aria-hidden /> : null}
                    </label>
                  </li>
                );
              })}
            </ul>
          </fieldset>
          <Footer>
            <Button variant="outline" size="lg" onClick={() => setStep(1)} disabled={pending}>
              <ChevronLeft className="size-5" /> {t("common.actions.back")}
            </Button>
            <Button size="lg" onClick={save} loading={pending} className="min-w-40">
              {t("easy.world.create")} <Sparkles className="size-5" />
            </Button>
          </Footer>
        </section>
      ) : (
        <section aria-labelledby="world-done-title" className="mt-6 flex flex-1 flex-col items-center text-center sm:mt-10">
          <span className="entry-done flex size-20 items-center justify-center rounded-full bg-success-soft text-success" aria-hidden>
            <Check className="size-10" strokeWidth={3} />
          </span>
          <h1 id="world-done-title" className="mt-5 text-2xl font-extrabold tracking-tight sm:text-3xl">
            {t("easy.world.done_title")}
          </h1>
          <p className="mx-auto mt-2 max-w-md text-base text-muted-foreground">
            {total > 0 ? t("easy.world.done_jobs", { count: num(total) }) : t("easy.world.done_subtitle")}
          </p>
          <ul className="mt-5 flex max-w-xl flex-wrap justify-center gap-2">
            {chosen.map((c) => (
              <li key={c.id} className="inline-flex items-center gap-1.5 rounded-full bg-primary-soft px-3 py-1.5 text-sm font-semibold text-primary">
                <CategoryIcon name={c.icon} className="size-4" />
                {c.name}
              </li>
            ))}
            <li className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-sm font-semibold">
              <MapPin className="size-4" aria-hidden />
              {regionName}
            </li>
          </ul>
          {/* keyingi qadamlar — faqat hali qilinmaganlari */}
          {!hasCv || !hasTelegram ? (
            <ul className="mt-8 grid w-full max-w-xl gap-3 text-left sm:grid-cols-2">
              {!hasCv ? (
                <NextStep href="/post/worker" icon={FileUser} title={t("easy.world.next_cv")} desc={t("easy.world.next_cv_desc")} />
              ) : null}
              {!hasTelegram ? (
                <NextStep href="/ai-alerts" icon={Bell} title={t("easy.world.next_telegram")} desc={t("easy.world.next_telegram_desc")} />
              ) : null}
            </ul>
          ) : null}
          <div className="mt-auto w-full max-w-sm pt-8">
            <Button asChild size="lg" fullWidth className="h-14 text-base font-bold">
              <Link href="/">
                {t("easy.world.enter")} <ArrowRight className="size-5" />
              </Link>
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}

/** Pastki amallar: telefonda ekran pastiga yopishadi (Telegram va safe-area hisobga olinadi) */
function Footer({ children }: { children: React.ReactNode }) {
  return (
    <div className="sticky bottom-0 z-10 -mx-4 mt-auto border-t border-border/70 bg-background px-4 pb-[max(0.75rem,var(--safe-bottom))] pt-3 sm:static sm:mx-0 sm:mt-8 sm:border-0 sm:bg-transparent sm:px-0">
      <div className="flex items-center justify-between gap-3">{children}</div>
    </div>
  );
}

function NextStep({ href, icon: Icon, title, desc }: { href: string; icon: typeof Bell; title: string; desc: string }) {
  return (
    <li className="flex">
      <Link href={href} className="press flex w-full items-start gap-3 rounded-2xl border border-border bg-card p-4 hover:border-primary/50">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary" aria-hidden>
          <Icon className="size-5" />
        </span>
        <span className="min-w-0">
          <span className="block text-base font-bold leading-snug">{title}</span>
          <span className="mt-0.5 block text-sm leading-snug text-muted-foreground">{desc}</span>
        </span>
      </Link>
    </li>
  );
}
