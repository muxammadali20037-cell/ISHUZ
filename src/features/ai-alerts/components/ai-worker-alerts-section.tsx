"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bot, BriefcaseBusiness, MapPin, Sparkles, Trash2, UserRound, Wallet } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Switch } from "@/components/ui/checkbox";
import { toast } from "@/components/ui/toast";
import { celebrate } from "@/lib/celebrate";
import { cn } from "@/lib/utils";
import { createAiWorkerAlert, deleteAiWorkerAlert, toggleAiWorkerAlert } from "../actions";
import type { AiAlertsData } from "../queries";

const money = (n: number) => new Intl.NumberFormat("ru-RU").format(n);

/**
 * AI yordamchi — ish beruvchi: "qanday ishchi kerak" deb o'z so'zi bilan yozadi; mos ishchi e'loni ochilishi bilan
 * Telegram'ga xabar. Topilgan nomzodlar (telefonsiz: ism + familiya bosh harfi) shu yerda ham ko'rinadi.
 */
export function AiWorkerAlertsSection({ data }: { data: AiAlertsData }) {
  const { t } = useT();
  const router = useRouter();
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  const examples = [t("saved.ai_alerts.employer.example_1"), t("saved.ai_alerts.employer.example_2"), t("saved.ai_alerts.employer.example_3")];
  const limit = data.workerAlerts.length >= 3;

  const errorText = (code: string) => {
    for (const key of [`saved.ai_alerts.employer.errors.${code}`, `saved.ai_alerts.errors.${code}`]) {
      const msg = t(key);
      if (msg !== key) return msg;
    }
    return t("common.errors.generic");
  };

  const create = () =>
    start(async () => {
      const res = await createAiWorkerAlert({ text });
      if (!res.ok) {
        toast.error(errorText(res.error ?? "generic"));
        return;
      }
      celebrate();
      toast.success(t("saved.ai_alerts.employer.created"), t("saved.ai_alerts.employer.created_desc"));
      setText("");
      router.refresh();
    });

  const toggle = (id: string, active: boolean) =>
    start(async () => {
      const res = await toggleAiWorkerAlert({ id, active });
      if (!res.ok) toast.error(t("common.errors.generic"));
      router.refresh();
    });

  const remove = (id: string) =>
    start(async () => {
      const res = await deleteAiWorkerAlert({ id });
      if (!res.ok) toast.error(t("common.errors.generic"));
      router.refresh();
    });

  return (
    <>
      {/* 1-qadam: o'z so'zi bilan */}
      <section className="rounded-3xl border-2 border-success/40 bg-card p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-xl bg-success text-success-foreground">
            <Sparkles className="size-5" />
          </span>
          <h2 className="text-lg font-bold">{t("saved.ai_alerts.employer.ask")}</h2>
        </div>
        <Textarea
          className="mt-4 min-h-[110px] text-base"
          value={text}
          maxLength={500}
          onChange={(e) => setText(e.target.value)}
          placeholder={t("saved.ai_alerts.employer.placeholder")}
          aria-label={t("saved.ai_alerts.employer.ask")}
        />
        <div className="mt-3 flex flex-wrap gap-2">
          {examples.map((ex) => (
            <button key={ex} type="button" onClick={() => setText(ex)} className="rounded-full bg-secondary px-3 py-1.5 text-left text-xs font-medium hover:bg-success-soft">
              {ex}
            </button>
          ))}
        </div>
        <Button size="lg" fullWidth className="mt-4 h-14 bg-success text-base text-success-foreground hover:bg-success/90" disabled={text.trim().length < 3 || limit} loading={pending} onClick={create}>
          <Bot className="size-5" /> {t("saved.ai_alerts.employer.start")}
        </Button>
        {limit ? <p className="mt-2 text-center text-xs text-muted-foreground">{t("saved.ai_alerts.errors.ai_alert_limit")}</p> : null}
      </section>

      {/* 2: kuzatilayotganlar */}
      {data.workerAlerts.length ? (
        <section className="space-y-3">
          <h2 className="text-base font-bold">{t("saved.ai_alerts.employer.mine")}</h2>
          {data.workerAlerts.map((a) => (
            <div key={a.id} className={cn("rounded-2xl border-2 p-4 transition-colors", a.isActive ? "border-success bg-success-soft/50" : "border-border bg-card")}>
              <div className="flex items-start gap-3">
                <span className={cn("mt-1 size-2.5 shrink-0 rounded-full", a.isActive ? "bg-success motion-safe:animate-pulse" : "bg-muted-foreground")} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{a.label}</p>
                  <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">«{a.prompt}»</p>
                  <p className="mt-2 text-xs font-medium text-muted-foreground">
                    {a.isActive ? t("saved.ai_alerts.watching") : t("saved.ai_alerts.paused")} · {t("saved.ai_alerts.found", { count: a.hits })}
                  </p>
                </div>
                <Switch checked={a.isActive} disabled={pending} onCheckedChange={(v) => toggle(a.id, v)} aria-label={t("saved.ai_alerts.toggle")} />
              </div>
              <div className="mt-3 flex justify-end">
                <button type="button" disabled={pending} onClick={() => remove(a.id)} className="inline-flex items-center gap-1 text-xs font-medium text-destructive hover:underline">
                  <Trash2 className="size-3.5" /> {t("common.actions.delete")}
                </button>
              </div>
            </div>
          ))}
        </section>
      ) : null}

      {/* 3: topilgan nomzodlar (telefonsiz) */}
      <section className="space-y-3">
        <h2 className="text-base font-bold">{t("saved.ai_alerts.employer.recent")}</h2>
        {data.workerHits.length ? (
          data.workerHits.map((h) => (
            <Link key={h.id} href={h.link} className="block rounded-2xl border border-border bg-card p-4 shadow-sm transition-colors hover:border-success/60">
              <p className="font-semibold">{h.profession || "—"}</p>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <UserRound className="size-4" /> {h.name || "—"}
                </span>
                {h.region ? (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="size-4" /> {h.region}
                  </span>
                ) : null}
                {h.experience ? (
                  <span className="inline-flex items-center gap-1">
                    <BriefcaseBusiness className="size-4" /> {t(`enums.experience_level.${h.experience}`)}
                  </span>
                ) : null}
                {h.salary ? (
                  <span className="inline-flex items-center gap-1 font-semibold text-success">
                    <Wallet className="size-4" /> {t("saved.ai_alerts.employer.expects", { amount: money(h.salary) })}
                  </span>
                ) : null}
              </p>
            </Link>
          ))
        ) : (
          <p className="rounded-2xl bg-secondary/60 p-4 text-sm text-muted-foreground">{t("saved.ai_alerts.employer.no_hits")}</p>
        )}
      </section>
    </>
  );
}
