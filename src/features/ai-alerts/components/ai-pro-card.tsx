import Link from "next/link";
import { BellRing, BriefcaseBusiness, Crown, Send, Sparkles, UsersRound } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { getAiProTeaser } from "../queries";

const money = (n: number) => new Intl.NumberFormat("ru-RU").format(n);

/**
 * "AI yordamchi · PRO" — pullik bonus (bosh sahifa va Kabinetim). Yumshoq brend sirti: ko'rinadi, lekin asosiy yo'llardan
 * (e'lon berish, qidirish) kuchli emas. Miltillash va sakrash yo'q.
 * Ikki yo'l: "Menga ish topsin" va "Menga ishchi topsin" — o'z so'zi bilan yozadi, mos e'lon chiqishi bilan Telegram'ga xabar.
 * Google Play ilovasi ichida narx ko'rsatilmaydi (to'lov u yerda sotilmaydi).
 */
/** `only` — joriy rejim: faqat shu yo'nalish tugmasi (ish izlovchiga "Menga ishchi topsin" ko'rsatilmaydi) */
export async function AiProCard({ userId, className, only }: { userId: string | null; className?: string; only?: "worker" | "employer" | null }) {
  const [{ t, locale }, pro] = await Promise.all([getT(), getAiProTeaser(userId)]);
  const badge = pro.paidUntil
    ? t("saved.ai_alerts.card_active", { date: formatDate(pro.paidUntil, locale) })
    : pro.free
      ? t("saved.ai_alerts.card_free")
      : pro.inApp
        ? null
        : t("saved.ai_alerts.card_price", { amount: money(pro.price) });
  const ways = [
    { role: "worker", href: "/ai-alerts?role=worker", track: "/ai-alerts/worker", icon: BriefcaseBusiness, label: t("saved.ai_alerts.card_worker") },
    { role: "employer", href: "/ai-alerts?role=employer", track: "/ai-alerts/employer", icon: UsersRound, label: t("saved.ai_alerts.card_employer") },
  ].filter((w) => !only || w.role === only);

  return (
    <section
      aria-labelledby="ai-pro-title"
      className={cn("rounded-2xl border border-primary/25 bg-primary-soft p-5 text-foreground sm:p-6", className)}
    >
      <div className="flex flex-wrap items-start gap-4">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground" aria-hidden>
          <BellRing className="size-7" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-0.5 text-sm font-extrabold uppercase tracking-wide text-primary-foreground">
              <Crown className="size-4" aria-hidden /> PRO
            </span>
            {badge ? <span className="rounded-full border border-primary/40 px-3 py-0.5 text-sm font-bold text-primary">{badge}</span> : null}
          </p>
          <h2 id="ai-pro-title" className="mt-2 text-xl font-bold leading-tight sm:text-2xl">
            {t("saved.ai_alerts.card_title")}
          </h2>
          <p className="mt-1 text-base leading-snug text-muted-foreground">{t("saved.ai_alerts.card_desc")}</p>
          <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-medium text-primary">
            <span className="inline-flex items-center gap-1.5">
              <Sparkles className="size-4" aria-hidden /> {t("saved.ai_alerts.card_point_ai")}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Send className="size-4" aria-hidden /> {t("saved.ai_alerts.card_point_tg")}
            </span>
          </p>
        </div>
      </div>
      <div className={cn("mt-5 grid gap-2", ways.length > 1 && "sm:grid-cols-2")}>
        {ways.map((w) => (
          <Link
            key={w.href}
            href={w.href}
            data-track="direction_select"
            data-track-to={w.track}
            className="press inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-center text-base font-semibold text-primary hover:border-primary/50 active:scale-[0.98]"
          >
            <w.icon className="size-5 shrink-0" aria-hidden /> {w.label}
          </Link>
        ))}
      </div>
    </section>
  );
}
