"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import { formatMoneyInput, parseMoney } from "@/features/post/schema";
import { saveAlertSubscription } from "../actions";
import type { AlertSubscription } from "../types";
import { AlertToggle } from "./alert-toggle";

const SCHEDULES = ["5_2", "6_1", "2_2", "shift", "flexible"] as const;

function Choice({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn("min-h-12 rounded-2xl border-2 px-4 py-2 text-left text-base font-semibold transition-colors", active ? "border-primary bg-primary-soft" : "border-border bg-card hover:bg-secondary/60")}
    >
      {children}
    </button>
  );
}

/** Bitta rol uchun xabarnoma sozlamalari: yoqish/Telegram, darhol yoki kunlik, filtrlar */
export function AlertSettings({
  sub,
  regions,
  profession,
  vacancies,
}: {
  sub: AlertSubscription;
  regions: { id: string; name: string }[];
  profession: { id: string; name: string } | null;
  vacancies: { id: string; title: string }[];
}) {
  const { t, tEnum } = useT();
  const [mode, setMode] = useState(sub.mode);
  const [ownProfession, setOwnProfession] = useState(sub.role === "worker" ? sub.professionNodeId !== null || !sub.enabled : false);
  const [regionId, setRegionId] = useState(sub.regionId ?? "");
  const [salary, setSalary] = useState(sub.salaryMin ? formatMoneyInput(String(sub.salaryMin)) : "");
  const [schedules, setSchedules] = useState<string[]>(sub.schedules);
  const [vacancyIds, setVacancyIds] = useState<string[]>(sub.vacancyIds);
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = () =>
    start(async () => {
      setSaved(false);
      setError(null);
      const res = await saveAlertSubscription({
        role: sub.role,
        enabled: true,
        mode,
        professionNodeId: sub.role === "worker" && ownProfession ? (profession?.id ?? null) : null,
        regionId: regionId || null,
        salaryMin: sub.role === "worker" ? parseMoney(salary) : null,
        schedules: sub.role === "worker" ? schedules : [],
        vacancyIds: sub.role === "employer" ? vacancyIds : [],
      });
      if (!res.ok) {
        const key = `easy.errors.${res.error}`;
        const msg = t(key);
        setError(msg === key ? t("easy.errors.generic") : msg);
        return;
      }
      setSaved(true);
    });

  const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  return (
    <section className="space-y-4 rounded-3xl border border-border bg-card p-5" aria-labelledby={`alerts-${sub.role}`}>
      <h2 id={`alerts-${sub.role}`} className="text-2xl font-bold">{t(sub.role === "worker" ? "easy.alerts.worker_section" : "easy.alerts.employer_section")}</h2>
      <AlertToggle role={sub.role} initialStatus={sub.status} defaults={{ professionNodeId: sub.role === "worker" ? (profession?.id ?? null) : null }} compact />

      <fieldset className="space-y-2">
        <legend className="font-bold">{t("easy.alerts.mode")}</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          <Choice active={mode === "instant"} onClick={() => setMode("instant")}>{t("easy.alerts.mode_instant")}</Choice>
          <Choice active={mode === "digest"} onClick={() => setMode("digest")}>{t("easy.alerts.mode_digest")}</Choice>
        </div>
      </fieldset>

      {sub.role === "worker" ? (
        <>
          {profession ? (
            <fieldset className="space-y-2">
              <legend className="font-bold">{t("easy.alerts.profession")}</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                <Choice active={ownProfession} onClick={() => setOwnProfession(true)}>{t("easy.alerts.profession_own", { name: profession.name })}</Choice>
                <Choice active={!ownProfession} onClick={() => setOwnProfession(false)}>{t("easy.alerts.profession_any")}</Choice>
              </div>
            </fieldset>
          ) : null}
          <label className="block space-y-2">
            <span className="font-bold">{t("easy.alerts.salary_min")}</span>
            <input
              inputMode="numeric"
              value={salary}
              onChange={(e) => setSalary(formatMoneyInput(e.target.value))}
              placeholder={t("easy.alerts.salary_any")}
              className="block h-14 w-full rounded-2xl border-2 border-input bg-background px-4 text-lg"
            />
          </label>
          <fieldset className="space-y-2">
            <legend className="font-bold">{t("easy.alerts.schedules")}</legend>
            <div className="flex flex-wrap gap-2">
              {SCHEDULES.map((s) => (
                <Choice key={s} active={schedules.includes(s)} onClick={() => setSchedules((x) => toggle(x, s))}>{tEnum("work_schedule", s)}</Choice>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">{t("easy.alerts.schedules_hint")}</p>
          </fieldset>
        </>
      ) : vacancies.length ? (
        <fieldset className="space-y-2">
          <legend className="font-bold">{t("easy.alerts.vacancies")}</legend>
          <div className="grid gap-2">
            <Choice active={vacancyIds.length === 0} onClick={() => setVacancyIds([])}>{t("easy.alerts.vacancies_all")}</Choice>
            {vacancies.map((v) => (
              <Choice key={v.id} active={vacancyIds.includes(v.id)} onClick={() => setVacancyIds((x) => toggle(x, v.id))}>{v.title}</Choice>
            ))}
          </div>
        </fieldset>
      ) : null}

      <label className="block space-y-2">
        <span className="font-bold">{t("easy.alerts.region")}</span>
        <select value={regionId} onChange={(e) => setRegionId(e.target.value)} className="block h-14 w-full rounded-2xl border-2 border-input bg-background px-4 text-lg">
          <option value="">{t("easy.alerts.region_any")}</option>
          {regions.map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
      </label>

      {error ? <p className="font-semibold text-destructive" role="alert">{error}</p> : null}
      {saved ? <p className="font-semibold text-success" role="status">{t("easy.alerts.saved")}</p> : null}
      <Button size="xl" className="h-14 w-full text-lg" disabled={pending || sub.status === "off"} onClick={save}>
        {pending ? t("easy.wizard.saving") : t("easy.alerts.save")}
      </Button>
      {sub.status === "off" ? <p className="text-sm text-muted-foreground">{t("easy.alerts.enable_first")}</p> : null}
    </section>
  );
}
