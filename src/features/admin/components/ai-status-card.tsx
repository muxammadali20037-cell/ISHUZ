"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bot, CheckCircle2, CircleAlert, PlayCircle, XCircle } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { GeminiProbeResult } from "@/lib/ai/gemini";
import { testAiProviders } from "../actions/ai";
import { aiErrorHint } from "../ai-hints";
import type { AiStatus } from "../queries/ai-status";
import { errorText } from "./note-dialog";

/**
 * AI holati: kalitlar bormi, modellar navbati, 24 soatdagi so'rov/xato, oxirgi chaqiruvlar va
 * "AI'ni sinash" — har bir modelga kichik so'rov. Xato matni oddiy maslahat bilan ko'rsatiladi.
 */
export function AiStatusCard({ status, canTest }: { status: AiStatus; canTest: boolean }) {
  const { t, locale } = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [probe, setProbe] = useState<GeminiProbeResult[] | null>(null);

  const configured = status.gemini || status.anthropic;
  const last = status.recent[0];
  const tone: "ok" | "warn" | "bad" = !configured ? "bad" : !last || last.ok ? "ok" : status.recent.some((r) => r.ok) ? "warn" : "bad";
  const hintText = (error: string | null) => {
    const h = aiErrorHint(error);
    return h ? t(`admin.ai.hint.${h}`) : null;
  };

  const test = () =>
    start(async () => {
      const res = await testAiProviders();
      if (!res.ok || !res.data) {
        toast.error(errorText(t, res.ok ? "generic" : res.error));
        return;
      }
      setProbe(res.data.results);
      router.refresh();
    });

  return (
    <section className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:p-5" aria-labelledby="ai-status-title">
      <div className="flex flex-wrap items-center gap-2">
        <Bot className="size-5 text-primary" aria-hidden />
        <h2 id="ai-status-title" className="text-base font-semibold">
          {t("admin.ai.title")}
        </h2>
        <span
          className={cn(
            "rounded-full px-2.5 py-0.5 text-xs font-bold",
            tone === "ok" ? "bg-success-soft text-success" : tone === "warn" ? "bg-warning-soft text-warning" : "bg-destructive-soft text-destructive",
          )}
        >
          {t(!configured ? "admin.ai.state_off" : tone === "ok" ? "admin.ai.state_ok" : tone === "warn" ? "admin.ai.state_warn" : "admin.ai.state_bad")}
        </span>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <dt className="text-muted-foreground">{t("admin.ai.gemini_key")}</dt>
        <dd className={status.gemini ? "font-medium text-success" : "font-medium text-destructive"}>{t(status.gemini ? "admin.ai.set" : "admin.ai.missing")}</dd>
        <dt className="text-muted-foreground">{t("admin.ai.claude_key")}</dt>
        <dd className="font-medium">{t(status.anthropic ? "admin.ai.set" : "admin.ai.missing_optional")}</dd>
        <dt className="text-muted-foreground">{t("admin.ai.models")}</dt>
        <dd className="break-words font-mono text-xs">{status.models.join(" → ")}</dd>
        <dt className="text-muted-foreground">{t("admin.ai.day")}</dt>
        <dd className="font-medium tabular">{t("admin.ai.day_value", { requests: status.day.requests, errors: status.day.errors })}</dd>
      </dl>

      {status.error ? <p className="mt-2 text-xs text-destructive">{hintText(status.error) ?? status.error}</p> : null}

      {canTest ? (
        <Button size="sm" className="mt-4" loading={pending} disabled={!status.gemini} onClick={test}>
          <PlayCircle className="size-4" /> {t("admin.ai.test")}
        </Button>
      ) : null}

      {probe ? (
        <ul className="mt-3 space-y-2">
          {probe.map((p) => (
            <li key={p.model} className={cn("rounded-xl border p-3 text-sm", p.ok ? "border-success/40 bg-success-soft/40" : "border-destructive/40 bg-destructive-soft/40")}>
              <p className="flex items-center gap-2 font-medium">
                {p.ok ? <CheckCircle2 className="size-4 text-success" /> : <XCircle className="size-4 text-destructive" />}
                <span className="font-mono text-xs">{p.model}</span>
                <span className="ml-auto text-xs text-muted-foreground tabular">{t("admin.ai.ms", { ms: p.latencyMs })}</span>
              </p>
              {p.error ? (
                <>
                  <p className="mt-1 break-words text-xs text-muted-foreground">{p.error}</p>
                  {hintText(p.error) ? <p className="mt-1 text-xs font-semibold">{hintText(p.error)}</p> : null}
                </>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      <h3 className="mt-4 text-sm font-semibold">{t("admin.ai.recent")}</h3>
      {status.recent.length ? (
        <ul className="mt-2 max-h-72 space-y-1.5 overflow-y-auto pr-1">
          {status.recent.map((r, i) => (
            <li key={`${r.at}-${i}`} className="rounded-lg bg-secondary/50 px-3 py-2 text-xs">
              <p className="flex flex-wrap items-center gap-x-2">
                {r.ok ? <CheckCircle2 className="size-3.5 text-success" /> : <CircleAlert className="size-3.5 text-destructive" />}
                <span className="font-medium">{r.feature}</span>
                <span className="font-mono text-muted-foreground">{r.model ?? "—"}</span>
                <span className="ml-auto text-muted-foreground">{formatDateTime(r.at, locale)}</span>
              </p>
              {r.error ? (
                <p className="mt-0.5 break-words text-muted-foreground">
                  {r.error}
                  {hintText(r.error) ? <span className="block font-semibold text-foreground">{hintText(r.error)}</span> : null}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">{t("admin.ai.none")}</p>
      )}
    </section>
  );
}
