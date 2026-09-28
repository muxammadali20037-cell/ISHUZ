"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import type { Category } from "@/lib/reference";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { Constants } from "@/types/database.types";
import { removeExtraProfession, saveExtraProfession, setPrimaryProfession } from "../actions";
import type { PickedProfession, TrailItem } from "../types";
import { ProfessionPicker } from "./profession-picker";

type Experience = (typeof Constants.public.Enums.experience_level)[number];
const EXPERIENCES = Constants.public.Enums.experience_level;
export interface ExtraProfession {
  id: string;
  categoryId: string;
  trail: TrailItem[];
  experience: Experience;
}

/**
 * Profil → "Kasblarim": asosiy kasb (moslik va bosh sahifa shu bo'yicha) va 5 tagacha qo'shimcha kasb,
 * har biriga alohida tajriba (masalan: Barista — 3 yil, Ofitsiant — 1 yil).
 */
export function MyProfessions({ categories, primary, extras }: { categories: Category[]; primary: PickedProfession | null; extras: ExtraProfession[] }) {
  const { t, tEnum, name } = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [changingPrimary, setChangingPrimary] = useState(!primary);
  const [adding, setAdding] = useState<PickedProfession | null | "picker">(null);
  const [newExp, setNewExp] = useState<Experience | null>(null);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) =>
    start(async () => {
      const res = await fn();
      if (!res.ok) {
        const key = `professions.errors.${res.error}`;
        toast.error(t(key) === key ? t("common.errors.generic") : t(key));
        return;
      }
      toast.success(t("professions.saved"));
      after?.();
      router.refresh();
    });

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-3 text-lg font-bold">{t("professions.primary")}</h2>
        {changingPrimary || !primary ? (
          <ProfessionPicker
            categories={categories}
            value={null}
            onChange={(p) => run(() => setPrimaryProfession({ nodeId: p.id }), () => setChangingPrimary(false))}
            title={t("professions.worker_title")}
            subtitle={t("professions.worker_sub")}
          />
        ) : (
          <ProfessionPicker categories={categories} value={primary} onChange={() => setChangingPrimary(true)} />
        )}
        {primary && changingPrimary ? (
          <Button variant="ghost" className="mt-2" onClick={() => setChangingPrimary(false)}>
            {t("common.actions.cancel")}
          </Button>
        ) : null}
      </section>

      <section>
        <h2 className="text-lg font-bold">{t("professions.extra")}</h2>
        <p className="mb-3 text-sm text-muted-foreground">{t("professions.extra_hint")}</p>
        <ul className="space-y-2">
          {extras.map((x) => (
            <li key={x.id} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{x.trail.at(-1) ? name(x.trail.at(-1)!) : ""}</p>
                  <p className="truncate text-xs text-muted-foreground">{x.trail.slice(0, -1).map((c) => name(c)).join(" › ")}</p>
                </div>
                <Button variant="ghost" size="icon-sm" aria-label={t("common.actions.delete")} disabled={pending} onClick={() => run(() => removeExtraProfession({ nodeId: x.id }))}>
                  <Trash2 className="size-4" />
                </Button>
              </div>
              <ExperienceChips value={x.experience} onChange={(e) => run(() => saveExtraProfession({ nodeId: x.id, experience: e }))} label={(e) => tEnum("experience_level", e)} />
            </li>
          ))}
        </ul>

        {adding === null ? (
          extras.length < 5 ? (
            <Button variant="outline" size="lg" className="mt-3 w-full" onClick={() => setAdding("picker")}>
              <Plus className="size-5" /> {t("professions.add_extra")}
            </Button>
          ) : null
        ) : adding === "picker" ? (
          <div className="mt-3 rounded-2xl border border-primary/30 p-3">
            <ProfessionPicker categories={categories} value={null} onChange={(p) => setAdding(p)} title={t("professions.add_extra")} />
            <Button variant="ghost" className="mt-2" onClick={() => setAdding(null)}>
              {t("common.actions.cancel")}
            </Button>
          </div>
        ) : (
          <div className="mt-3 space-y-3 rounded-2xl border border-primary/30 p-4">
            <p className="font-semibold">{t("professions.extra_experience", { name: adding.trail.at(-1) ? name(adding.trail.at(-1)!) : "" })}</p>
            <ExperienceChips value={newExp} onChange={setNewExp} label={(e) => tEnum("experience_level", e)} />
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => (setAdding(null), setNewExp(null))}>
                {t("common.actions.cancel")}
              </Button>
              <Button
                className="flex-1"
                disabled={!newExp}
                loading={pending}
                onClick={() => newExp && run(() => saveExtraProfession({ nodeId: adding.id, experience: newExp }), () => (setAdding(null), setNewExp(null)))}
              >
                {t("common.actions.save")}
              </Button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function ExperienceChips({ value, onChange, label }: { value: Experience | null; onChange: (e: Experience) => void; label: (e: Experience) => string }) {
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {EXPERIENCES.map((e) => (
        <button
          key={e}
          type="button"
          onClick={() => onChange(e)}
          aria-pressed={value === e}
          className={cn("rounded-full border px-3.5 py-2 text-sm font-medium transition-colors", value === e ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:border-primary")}
        >
          {label(e)}
        </button>
      ))}
    </div>
  );
}
