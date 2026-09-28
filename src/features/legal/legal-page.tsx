import Link from "next/link";
import type { Metadata } from "next";
import uz from "../../../messages/uz/legal.json";
import ru from "../../../messages/ru/legal.json";
import { getLocale } from "@/lib/i18n/server";
import { getServerEnv } from "@/lib/env";
import { localeAlternates } from "@/lib/seo";
import { Shell } from "@/components/shared/shell";

type Doc = "privacy" | "deletion";
const PATH: Record<Doc, string> = { privacy: "/privacy", deletion: "/account-deletion" };

async function content() {
  const locale = await getLocale();
  return { locale, L: locale === "ru" ? ru : uz };
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
  const { L } = await content();
  const { SUPPORT_EMAIL, TELEGRAM_BOT_USERNAME } = getServerEnv();
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
            <Body text={text ?? ""} />
          </section>
        ))}
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
        <p className="mt-8 text-sm">
          <Link href={doc === "privacy" ? PATH.deletion : PATH.privacy} className="font-medium text-primary hover:underline">
            {L[doc === "privacy" ? "deletion" : "privacy"].title} →
          </Link>
        </p>
      </article>
    </Shell>
  );
}
