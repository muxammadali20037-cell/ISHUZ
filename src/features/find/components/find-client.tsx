"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Pencil, SlidersHorizontal, Users } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import type { Category } from "@/lib/reference";
import { Button } from "@/components/ui/button";
import { Dialog, Sheet } from "@/components/ui/dialog";
import { ProfessionPicker } from "@/features/professions/components/profession-picker";
import { ChoiceButtons } from "@/features/post/components/wizard-frame";
import { MoneyInput } from "@/features/post/components/inputs";
import { SCHEDULES } from "@/features/post/types";
import type { Enums } from "@/types/database.types";
import type { FindMode } from "../intent";

/** Kasb qadami: tanlangan zahoti keyingi qadamga (URL'da __NODE__ o'rniga tugun id) */
export function FindProfessionStep({ categories, title, initialQuery, hrefTemplate }: { categories: Category[]; title: string; initialQuery: string; hrefTemplate: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <div aria-busy={busy || undefined}>
      <ProfessionPicker
        categories={categories}
        value={null}
        initialQuery={initialQuery}
        title={title}
        onChange={(p) => {
          setBusy(true);
          router.push(hrefTemplate.replace("__NODE__", p.id));
        }}
      />
    </div>
  );
}

/** "O'zgartirish": ish/ishchi, kasb yoki hudud — uchta katta tugma */
export function ChangeSheet({ modeHref, professionHref, regionHref }: { modeHref: string; professionHref: string; regionHref: string }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const item = "flex min-h-14 w-full items-center gap-3 rounded-2xl border-2 border-border bg-card px-4 text-lg font-semibold hover:border-primary/50";
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button type="button" variant="outline" className="h-12 px-4 text-base" onClick={() => setOpen(true)}>
        <Pencil className="size-5" aria-hidden /> {t("easy.search.change")}
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
  count,
}: {
  mode: FindMode;
  salary: number | null;
  schedule: Enums<"work_schedule"> | null;
  noexp: boolean;
  exp: boolean;
  count: number;
}) {
  const { t, tEnum } = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [s, setS] = useState(salary ? String(salary) : "");
  const [sch, setSch] = useState<Enums<"work_schedule"> | "">(schedule ?? "");
  const [ne, setNe] = useState(noexp);
  const [ex, setEx] = useState(exp);

  const apply = (reset = false) => {
    const url = new URL(window.location.href);
    for (const k of ["salary", "schedule", "noexp", "exp", "page"]) url.searchParams.delete(k);
    if (!reset) {
      if (mode === "jobs") {
        if (s) url.searchParams.set("salary", s);
        if (sch) url.searchParams.set("schedule", sch);
        if (ne) url.searchParams.set("noexp", "1");
      } else if (ex) url.searchParams.set("exp", "1");
    }
    setOpen(false);
    router.push(`${url.pathname}${url.search}`);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button type="button" variant={count ? "soft" : "outline"} className="h-12 px-4 text-base" onClick={() => setOpen(true)}>
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
