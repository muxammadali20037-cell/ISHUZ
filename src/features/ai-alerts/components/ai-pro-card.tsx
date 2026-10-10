import Link from "next/link";
import { BellRing, BriefcaseBusiness, Crown, Send, Sparkles, UsersRound } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { getAiProTeaser } from "../queries";

const money = (n: number) => new Intl.NumberFormat("ru-RU").format(n);

/**
 * "AI yordamchi · PRO" — pullik bonus, ko'zga tashlanib turadi (bosh sahifa va Kabinetim).
 * Ikki yo'l: "Menga ish topsin" va "Menga ishchi topsin" — o'z so'zi bilan yozadi, mos e'lon chiqishi bilan Telegram'ga xabar.
 * Google Play ilovasi ichida narx ko'rsatilmaydi (to'lov u yerda sotilmaydi).
 */
export async function AiProCard({ userId, className }: { userId: string | null; className?: string }) {
  const [{ t, locale }, pro] = await Promise.all([getT(), getAiProTeaser(userId)]);
  const badge = pro.paidUntil
    ? t("saved.ai_alerts.card_active", { date: formatDate(pro.paidUntil, locale) })
    : pro.free
      ? t("saved.ai_alerts.card_free")
      : pro.inApp
        ? null
        : t("saved.ai_alerts.card_price", { amount: money(pro.price) });
  const ways = [
    { href: "/ai-alerts?role=worker", track: "/ai-alerts/worker", icon: BriefcaseBusiness, label: t("saved.ai_alerts.card_worker") },
    { href: "/ai-alerts?role=employer", track: "/ai-alerts/employer", icon: UsersRound, label: t("saved.ai_alerts.card_employer") },
  ];

  return (
    <section
      aria-labelledby="ai-pro-title"
      className={cn("relative overflow-hidden rounded-3xl bg-gradient-to-br from-violet-600 via-primary to-sky-500 p-5 text-white shadow-lg sm:p-7", className)}
    >
      <span className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-white/10 blur-2xl" aria-hidden />
      <div className="relative flex flex-wrap items-start gap-4">
        <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-white/20" aria-hidden>
          <BellRing className="size-8 motion-safe:animate-pulse" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-300 px-2.5 py-0.5 text-sm font-extrabold uppercase tracking-wide text-amber-950">
              <Crown className="size-4" aria-hidden /> PRO
            </span>
            {badge ? <span className="rounded-full bg-white/20 px-3 py-0.5 text-sm font-bold">{badge}</span> : null}
          </p>
          <h2 id="ai-pro-title" className="mt-2 text-2xl font-extrabold leading-tight sm:text-[1.7rem]">
            {t("saved.ai_alerts.card_title")}
          </h2>
          <p className="mt-1 text-lg leading-snug text-white/90">{t("saved.ai_alerts.card_desc")}</p>
          <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-base text-white/85">
            <span className="inline-flex items-center gap-1.5">
              <Sparkles className="size-4" aria-hidden /> {t("saved.ai_alerts.card_point_ai")}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Send className="size-4" aria-hidden /> {t("saved.ai_alerts.card_point_tg")}
            </span>
          </p>
        </div>
      </div>
      <div className="relative mt-5 grid gap-3 sm:grid-cols-2">
        {ways.map((w) => (
          <Link
            key={w.href}
            href={w.href}
            transitionTypes={["nav-forward"]}
            data-track="direction_select"
            data-track-to={w.track}
            data-sfx="pop"
            className="group inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-center text-lg font-bold text-primary shadow-sm transition-[translate,scale] duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:-translate-y-0.5 focus-visible:ring-4 focus-visible:ring-white/60 active:scale-[0.97] active:duration-75"
          >
            <w.icon className="size-6 shrink-0" aria-hidden /> {w.label}
          </Link>
        ))}
      </div>
    </section>
  );
}
