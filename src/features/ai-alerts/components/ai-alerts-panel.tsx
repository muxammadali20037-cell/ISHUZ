"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BadgeCheck, Bot, BriefcaseBusiness, Building2, Crown, MapPin, Sparkles, Trash2, UsersRound, Wallet } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Switch } from "@/components/ui/checkbox";
import { toast } from "@/components/ui/toast";
import { celebrate } from "@/lib/celebrate";
import { InAppNote } from "@/features/billing/components/payment-dialog";
import { cn } from "@/lib/utils";
import { createAiAlert, deleteAiAlert, startAiAlertsCheckout, toggleAiAlert } from "../actions";
import type { AiAlertsData } from "../queries";
import { TelegramConnect } from "./telegram-connect";
import { AiWorkerAlertsSection } from "./ai-worker-alerts-section";

const money = (n: number) => new Intl.NumberFormat("ru-RU").format(n);

/**
 * AI yordamchi (PRO): 1) o'z so'zi bilan yozadi → 2) AI tushunganini ko'rsatadi → 3) mos e'lon chiqishi bilan
 * Telegram'ga xabar. Ikki yo'l: "Menga ish topsin" (mos vakansiya — kim joylagani bilan) va "Menga ishchi topsin"
 * (mos ishchi e'loni). Obuna bitta — ikkala yo'lni qamraydi.
 */
export function AiAlertsPanel({ data, role }: { data: AiAlertsData; role: "worker" | "employer" }) {
  const { t } = useT();
  const router = useRouter();
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  const examples = [t("saved.ai_alerts.example_1"), t("saved.ai_alerts.example_2"), t("saved.ai_alerts.example_3")];

  const create = () =>
    start(async () => {
      const res = await createAiAlert({ text });
      if (!res.ok) {
        const key = `saved.ai_alerts.errors.${res.error}`;
        const msg = t(key);
        toast.error(msg !== key ? msg : t("common.errors.generic"));
        return;
      }
      celebrate();
      toast.success(t("saved.ai_alerts.created"), t("saved.ai_alerts.created_desc"));
      setText("");
      router.refresh();
    });

  const toggle = (id: string, active: boolean) =>
    start(async () => {
      const res = await toggleAiAlert({ id, active });
      if (!res.ok) toast.error(t("common.errors.generic"));
      router.refresh();
    });

  const pay = (provider: "payme" | "click") =>
    start(async () => {
      const res = await startAiAlertsCheckout({ provider });
      if (!res.ok || !res.data) {
        toast.error(t("common.errors.generic"));
        return;
      }
      window.location.href = res.data.url;
    });

  const active = data.free || !!data.paidUntil;
  const until = data.paidUntil ? new Date(data.paidUntil).toLocaleDateString("ru-RU") : null;

  const remove = (id: string) =>
    start(async () => {
      const res = await deleteAiAlert({ id });
      if (!res.ok) toast.error(t("common.errors.generic"));
      router.refresh();
    });

  return (
    <div className="space-y-6">
      {/* PRO: narx va obuna holati */}
      <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-amber-400 to-orange-500 p-5 text-white shadow-md">
        <div className="flex items-center gap-3">
          <Crown className="size-8 shrink-0" />
          <div className="min-w-0">
            <p className="text-lg font-extrabold">{t("saved.ai_alerts.pro")}</p>
            <p className="text-sm text-white/90">
              {data.free
                ? t("saved.ai_alerts.free_now")
                : data.paidUntil
                  ? t("saved.ai_alerts.active_until", { date: until ?? "" })
                  : data.inApp
                    ? t("saved.ai_alerts.need_pay")
                    : t("saved.ai_alerts.price", { amount: money(data.price) })}
            </p>
          </div>
        </div>
        <ol className="mt-3 grid gap-1 text-sm text-white/95">
          {[t("saved.ai_alerts.how_1"), t("saved.ai_alerts.how_2"), t("saved.ai_alerts.how_3")].map((step, i) => (
            <li key={step} className="flex items-start gap-2">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-white/25 text-xs font-bold">{i + 1}</span>
              {step}
            </li>
          ))}
        </ol>
        {!data.free && !data.inApp ? (
          data.providers.length ? (
            <div className="mt-4 grid min-w-0 gap-2">
              {data.providers.includes("payme") ? (
                <Button size="lg" className="h-auto min-h-14 w-full whitespace-normal bg-white py-3 text-base font-bold text-[#00A6A6] hover:bg-white/90" loading={pending} onClick={() => pay("payme")}>
                  <Wallet className="size-5" /> {data.paidUntil ? t("saved.ai_alerts.extend_payme", { amount: money(data.price) }) : t("saved.ai_alerts.pay_payme", { amount: money(data.price) })}
                </Button>
              ) : null}
              {data.providers.includes("click") ? (
                <Button size="lg" variant="outline" className="h-12 w-full border-white/60 bg-white/10 text-white hover:bg-white/20" loading={pending} onClick={() => pay("click")}>
                  {t("saved.ai_alerts.pay_click")}
                </Button>
              ) : null}
            </div>
          ) : (
            <p className="mt-3 rounded-xl bg-white/20 p-2 text-center text-sm">{t("saved.ai_alerts.pay_soon")}</p>
          )
        ) : null}
      </div>
      {!active && data.inApp ? <InAppNote /> : null}
      {!active && !data.inApp ? <p className="rounded-2xl border-2 border-warning bg-warning-soft p-3 text-sm font-medium">{t("saved.ai_alerts.need_pay")}</p> : null}

      {/* Telegram ulanmagan bo'lsa — eng muhim ogohlantirish (bir martalik xavfsiz havola) */}
      <TelegramConnect connected={data.telegramConnected} botConfigured={data.botConfigured} />

      {/* Ikki yo'l: ish topish / ishchi topish */}
      <nav aria-label={t("saved.ai_alerts.title")} className="grid grid-cols-2 gap-2 rounded-2xl bg-secondary p-1.5">
        {(["worker", "employer"] as const).map((r) => (
          <Link
            key={r}
            href={`/ai-alerts?role=${r}`}
            replace
            scroll={false}
            aria-current={role === r ? "page" : undefined}
            className={cn(
              "flex min-h-12 items-center justify-center gap-2 rounded-xl px-2 text-center text-base font-bold transition-colors",
              role === r ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-card",
            )}
          >
            {r === "worker" ? <BriefcaseBusiness className="size-5 shrink-0" aria-hidden /> : <UsersRound className="size-5 shrink-0" aria-hidden />}
            {t(r === "worker" ? "saved.ai_alerts.tab_worker" : "saved.ai_alerts.tab_employer")}
          </Link>
        ))}
      </nav>

      {role === "employer" ? (
        <AiWorkerAlertsSection data={data} />
      ) : (
        <>
          {/* 1-qadam: o'z so'zi bilan */}
          <section className="rounded-3xl border-2 border-primary/30 bg-card p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <Sparkles className="size-5" />
              </span>
              <h2 className="text-lg font-bold">{t("saved.ai_alerts.ask")}</h2>
            </div>
            <Textarea
              className="mt-4 min-h-[110px] text-base"
              value={text}
              maxLength={500}
              onChange={(e) => setText(e.target.value)}
              placeholder={t("saved.ai_alerts.placeholder")}
            />
            <div className="mt-3 flex flex-wrap gap-2">
              {examples.map((ex) => (
                <button key={ex} type="button" onClick={() => setText(ex)} className="rounded-full bg-secondary px-3 py-1.5 text-left text-xs font-medium hover:bg-primary-soft">
                  {ex}
                </button>
              ))}
            </div>
            <Button size="lg" fullWidth className="mt-4 h-14 text-base" disabled={text.trim().length < 3 || data.alerts.length >= 3} loading={pending} onClick={create}>
              <Bot className="size-5" /> {t("saved.ai_alerts.start")}
            </Button>
            {data.alerts.length >= 3 ? <p className="mt-2 text-center text-xs text-muted-foreground">{t("saved.ai_alerts.errors.ai_alert_limit")}</p> : null}
          </section>

          {/* 2: kuzatilayotganlar */}
          {data.alerts.length ? (
            <section className="space-y-3">
              <h2 className="text-base font-bold">{t("saved.ai_alerts.mine")}</h2>
              {data.alerts.map((a) => (
                <div key={a.id} className={cn("rounded-2xl border-2 p-4 transition-colors", a.isActive ? "border-success bg-success-soft/50" : "border-border bg-card")}>
                  <div className="flex items-start gap-3">
                    <span className={cn("mt-1 size-2.5 shrink-0 rounded-full", a.isActive ? "animate-pulse bg-success" : "bg-muted-foreground")} aria-hidden />
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

          {/* 3: topilgan vakansiyalar — kim joylagani bilan */}
          <section className="space-y-3">
            <h2 className="text-base font-bold">{t("saved.ai_alerts.recent")}</h2>
            {data.hits.length ? (
              data.hits.map((h) => (
                <Link key={h.id} href={h.link} className="block rounded-2xl border border-border bg-card p-4 shadow-sm transition-colors hover:border-primary/50">
                  <p className="font-semibold">{h.title}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Building2 className="size-4" /> {h.who || "—"}
                      {h.verified ? <BadgeCheck className="size-4 text-primary" aria-label={t("common.labels.verified")} /> : null}
                    </span>
                    {h.region ? (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="size-4" /> {h.region}
                      </span>
                    ) : null}
                    <span className="inline-flex items-center gap-1 font-semibold text-success">
                      <Wallet className="size-4" />
                      {h.negotiable || (!h.salaryFrom && !h.salaryTo)
                        ? t("saved.ai_alerts.negotiable")
                        : h.salaryFrom && h.salaryTo
                          ? `${money(h.salaryFrom)} – ${money(h.salaryTo)}`
                          : money((h.salaryFrom ?? h.salaryTo)!)}
                    </span>
                  </p>
                </Link>
              ))
            ) : (
              <p className="rounded-2xl bg-secondary/60 p-4 text-sm text-muted-foreground">{t("saved.ai_alerts.no_hits")}</p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
