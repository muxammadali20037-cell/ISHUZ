"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, MapPin, Pencil, RotateCw, SlidersHorizontal, Users } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";
import { Dialog, Sheet } from "@/components/ui/dialog";
import { ChoiceButtons } from "@/features/post/components/wizard-frame";
import { MoneyInput } from "@/features/post/components/inputs";
import { SCHEDULES } from "@/features/post/types";
import type { Enums } from "@/types/database.types";
import type { FindMode } from "../intent";

/** "O'zgartirish": ish/ishchi, kasb yoki hudud — uchta katta tugma */
export function ChangeSheet({ modeHref, professionHref, regionHref, compact }: { modeHref: string; professionHref: string; regionHref: string; compact?: boolean }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const item = "flex min-h-14 w-full items-center gap-3 rounded-2xl border-2 border-border bg-card px-4 text-lg font-semibold hover:border-primary/50";
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        type="button"
        variant={compact ? "ghost" : "outline"}
        className={compact ? "h-11 px-2.5 text-sm font-semibold text-primary" : "h-12 px-4 text-base"}
        onClick={() => setOpen(true)}
      >
        <Pencil className={compact ? "size-4" : "size-5"} aria-hidden /> {t("easy.search.change")}
      </Button>
      <Sheet title={t("easy.search.change")}>
        <div className="grid gap-3 pb-2">
          <Link href={professionHref} className={item} onClick={() => setOpen(false)}>
            <Pencil className="size-5 text-primary" aria-hidden /> {t("easy.search.change_profession")}
          </Link>
          <Link href={regionHref} className={item} onClick={() => setOpen(false)}>
            <MapPin className="size-5 text-primary" aria-hidden /> {t("easy.search.change_region")}
          </Link>
          <Link href={modeHref} className={item} onClick={() => setOpen(false)}>
            <Users className="size-5 text-primary" aria-hidden /> {t("easy.search.change_mode")}
          </Link>
        </div>
      </Sheet>
    </Dialog>
  );
}

/** Qo'shimcha filtrlar faqat shu yerda (ekran bo'ylab sochilmaydi) */
export function FilterSheet({
  mode,
  salary,
  schedule,
  noexp,
  exp,
  daily = false,
  count,
}: {
  mode: FindMode;
  salary: number | null;
  schedule: Enums<"work_schedule"> | null;
  noexp: boolean;
  exp: boolean;
  /** faqat kunlik haqli ishlar (pay=daily) */
  daily?: boolean;
  count: number;
}) {
  const { t, tEnum } = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [s, setS] = useState(salary ? String(salary) : "");
  const [sch, setSch] = useState<Enums<"work_schedule"> | "">(schedule ?? "");
  const [ne, setNe] = useState(noexp);
  const [ex, setEx] = useState(exp);
  const [dy, setDy] = useState(daily);

  // oyna har ochilganda URL'dagi joriy filtrlar bilan boshlanadi ("Tozalash"dan keyin eski tanlov qolib ketmaydi)
  const openSheet = () => {
    setS(salary ? String(salary) : "");
    setSch(schedule ?? "");
    setNe(noexp);
    setEx(exp);
    setDy(daily);
    setOpen(true);
  };

  const apply = (reset = false) => {
    const url = new URL(window.location.href);
    for (const k of ["salary", "schedule", "noexp", "exp", "pay", "page"]) url.searchParams.delete(k);
    if (!reset) {
      if (mode === "jobs") {
        if (s) url.searchParams.set("salary", s);
        if (sch) url.searchParams.set("schedule", sch);
        if (ne) url.searchParams.set("noexp", "1");
        if (dy) url.searchParams.set("pay", "daily");
      } else if (ex) url.searchParams.set("exp", "1");
    }
    setOpen(false);
    router.push(`${url.pathname}${url.search}`);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button type="button" variant={count ? "soft" : "outline"} className="h-12 px-4 text-base" onClick={openSheet}>
        <SlidersHorizontal className="size-5" aria-hidden /> {count ? t("easy.search.filter_count", { count }) : t("easy.search.filter")}
      </Button>
      <Sheet
        title={t("easy.search.filter")}
        footer={
          <div className="flex gap-3">
            <Button type="button" variant="outline" className="h-14 px-4 text-base" onClick={() => apply(true)}>
              {t("easy.search.reset")}
            </Button>
            <Button type="button" className="h-14 flex-1 text-lg" onClick={() => apply(false)}>
              {t("easy.search.apply")}
            </Button>
          </div>
        }
      >
        <div className="space-y-6 pb-2 text-lg">
          {mode === "jobs" ? (
            <>
              <div>
                <label htmlFor="f-salary" className="mb-2 block font-semibold">
                  {t("easy.search.salary_min")}
                </label>
                <MoneyInput id="f-salary" value={s} onChange={setS} placeholder="3 000 000" />
              </div>
              <div>
                <p className="mb-2 font-semibold">{t("easy.search.schedule")}</p>
                <ChoiceButtons
                  label={t("easy.search.schedule")}
                  value={sch}
                  onChange={setSch}
                  options={[{ value: "" as const, label: t("easy.search.any") }, ...SCHEDULES.map((x) => ({ value: x, label: tEnum("work_schedule", x) }))]}
                />
              </div>
              <label className="flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl border-2 border-border p-4">
                <input type="checkbox" checked={ne} onChange={(e) => setNe(e.target.checked)} className="size-7 accent-[var(--primary)]" />
                <span className="font-semibold">{t("easy.search.no_experience")}</span>
              </label>
              <label className="flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl border-2 border-border p-4">
                <input type="checkbox" checked={dy} onChange={(e) => setDy(e.target.checked)} className="size-7 accent-[var(--primary)]" />
                <span>
                  <span className="block font-semibold">{t("easy.search.daily_only")}</span>
                  <span className="block text-base text-muted-foreground">{t("easy.search.daily_only_desc")}</span>
                </span>
              </label>
            </>
          ) : (
            <label className="flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl border-2 border-border p-4">
              <input type="checkbox" checked={ex} onChange={(e) => setEx(e.target.checked)} className="size-7 accent-[var(--primary)]" />
              <span className="font-semibold">{t("easy.search.experienced")}</span>
            </label>
          )}
        </div>
      </Sheet>
    </Dialog>
  );
}

/** Natijalarni qayta yuklash: URL (kasb, hudud, filtr, sahifa) o'zgarmaydi — faqat server qayta so'raladi */
export function RetryButton({ label }: { label: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button size="xl" className="h-14 text-lg" disabled={pending} onClick={() => start(() => router.refresh())}>
      {pending ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <RotateCw className="size-5" aria-hidden />} {label}
    </Button>
  );
}
