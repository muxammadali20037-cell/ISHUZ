import Link from "next/link";
import type { Metadata } from "next";
import uz from "../../../messages/uz/legal.json";
import ru from "../../../messages/ru/legal.json";
import en from "../../../messages/en/legal.json";
import { getLocale } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/format";
import { getServerEnv } from "@/lib/env";
import { localeAlternates } from "@/lib/seo";
import { Shell } from "@/components/shared/shell";

type Doc = "privacy" | "deletion" | "terms";
const PATH: Record<Doc, string> = { privacy: "/privacy", deletion: "/account-deletion", terms: "/terms" };
const RELATED: Record<Doc, Doc[]> = { privacy: ["terms", "deletion"], terms: ["privacy", "deletion"], deletion: ["privacy", "terms"] };

/** Ofertadagi {price_*} kabi o'rinlar — joriy narxlar app_settings'dan (admin o'zgartirsa, sahifa ham o'zgaradi) */
async function priceVars(locale: Awaited<ReturnType<typeof getLocale>>): Promise<Record<string, string>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("app_settings")
    .select("key, value")
    .in("key", ["price_worker_listing", "price_vacancy_publish", "price_ai_alerts", "listing_days", "vacancy_lifetime_days", "ai_alerts_days", "listing_discount_percent", "listing_discount_until"]);
  const get = (k: string) => data?.find((r) => r.key === k)?.value;
  const int = (k: string, d: number) => Number(get(k) ?? d) || d;
  const money = (k: string, d: number) => formatMoney(int(k, d), locale, { withCurrency: false });
  const until = get("listing_discount_until");
  return {
    price_worker_listing: money("price_worker_listing", 10000),
    price_vacancy_publish: money("price_vacancy_publish", 50000),
    price_ai_alerts: money("price_ai_alerts", 15000),
    listing_days: String(int("listing_days", 10)),
    vacancy_days: String(int("vacancy_lifetime_days", 10)),
    ai_days: String(int("ai_alerts_days", 30)),
    discount_percent: String(int("listing_discount_percent", 50)),
    discount_until: typeof until === "string" ? new Date(until).toLocaleDateString(locale === "en" ? "en-GB" : "ru-RU", { timeZone: "Asia/Tashkent" }) : "—",
  };
}

const fill = (text: string, vars: Record<string, string>) => text.replace(/\{(\w+)\}/g, (m, k: string) => vars[k] ?? m);

async function content() {
  const locale = await getLocale();
  return { locale, L: locale === "ru" ? ru : locale === "en" ? en : uz };
}

export async function legalMetadata(doc: Doc): Promise<Metadata> {
  const { locale, L } = await content();
  return { title: L[doc].title, description: L[doc].description, alternates: localeAlternates(PATH[doc], locale) };
}

/** "- " bilan boshlangan qatorlar — ro'yxat, qolganlari — paragraf */
function Body({ text }: { text: string }) {
  const lines = text.split("\n");
  const items = lines.filter((l) => l.startsWith("- "));
  const paras = lines.filter((l) => !l.startsWith("- ") && l.trim());
  return (
    <>
      {items.length ? (
        <ul className="mt-2 list-disc space-y-1.5 pl-5">
          {items.map((l) => (
            <li key={l}>{l.slice(2)}</li>
          ))}
        </ul>
      ) : null}
      {paras.map((p) => (
        <p key={p} className="mt-2">
          {p}
        </p>
      ))}
    </>
  );
}

/** Ochiq huquqiy sahifalar: maxfiylik siyosati va hisobni o'chirish (Google Play talabi) */
export async function LegalPage({ doc }: { doc: Doc }) {
  const { L, locale } = await content();
  const { SUPPORT_EMAIL, TELEGRAM_BOT_USERNAME, LEGAL_OPERATOR } = getServerEnv();
  const vars = doc === "terms" ? await priceVars(locale) : {};
  const bot = TELEGRAM_BOT_USERNAME?.replace(/^@/, "");
  const d = L[doc];
  return (
    <Shell>
      <article className="container-narrow py-8 leading-relaxed text-foreground/90 sm:py-12">
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">{d.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{L.updated}</p>
        <p className="mt-5">{d.intro}</p>
        {d.sections.map(([title, text]) => (
          <section key={title} className="mt-7">
            <h2 className="text-lg font-bold text-foreground">{title}</h2>
            <Body text={fill(text ?? "", vars)} />
          </section>
        ))}
        {LEGAL_OPERATOR ? (
          <section className="mt-7">
            <h2 className="text-lg font-bold text-foreground">{L.operator_title}</h2>
            <p className="mt-2">{LEGAL_OPERATOR}</p>
          </section>
        ) : null}
        <section className="mt-7 rounded-2xl bg-secondary p-5">
          <h2 className="text-lg font-bold text-foreground">{L.contact_title}</h2>
          <p className="mt-1">{L.contact_body}</p>
          <ul className="mt-2 space-y-1 font-medium">
            {SUPPORT_EMAIL ? (
              <li>
                Email:{" "}
                <a className="text-primary hover:underline" href={`mailto:${SUPPORT_EMAIL}`}>
                  {SUPPORT_EMAIL}
                </a>
              </li>
            ) : null}
            {bot ? (
              <li>
                Telegram:{" "}
                <a className="text-primary hover:underline" href={`https://t.me/${bot}`} target="_blank" rel="noopener noreferrer">
                  @{bot}
                </a>
              </li>
            ) : null}
          </ul>
        </section>
        <p className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-sm">
          {RELATED[doc].map((r) => (
            <Link key={r} href={PATH[r]} className="font-medium text-primary hover:underline">
              {L[r].title} →
            </Link>
          ))}
        </p>
      </article>
    </Shell>
  );
}
