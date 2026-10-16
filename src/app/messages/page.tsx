import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { Search } from "lucide-react";
import { requireSession } from "@/features/auth/session";
import { getT } from "@/lib/i18n/server";
import { Shell } from "@/components/shared/shell";
import { PageHeader } from "@/components/ui/misc";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { conversationSides, getMyConversations } from "@/features/chat/queries";
import { ConversationList } from "@/features/chat/components/conversation-list";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("chat.title"), description: t("chat.description") };
}

type Filter = "employers" | "candidates";
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/**
 * /messages — suhbatlar ro'yxati (?error=<code> → toast). S3: qidiruv (ism, vakansiya, oxirgi xabar) va
 * "Barchasi · Ish beruvchilar · Nomzodlar" — filtr faqat ikkala turdagi suhbat bo'lsa ko'rsatiladi (rolga mos).
 */
export default async function MessagesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await requireSession("/messages");
  // ish beruvchi (yoki ikkala rolda hozir ish beruvchi) — bo'sh holatda "arizani oching" yo'li
  const audience = session.employerOnboarded && (session.activeRole === "employer" || !session.workerOnboarded) ? "employer" : "worker";
  const sp = await searchParams;
  const error = typeof sp.error === "string" ? sp.error : undefined;
  const q = one(sp.q).replace(/\s+/g, " ").trim().slice(0, 80);
  const f: Filter | null = one(sp.f) === "employers" ? "employers" : one(sp.f) === "candidates" ? "candidates" : null;
  const [all, { t }] = await Promise.all([getMyConversations(), getT()]);
  const sides = await conversationSides(all, session.workerId ?? null);
  const kinds = new Set(sides.values());
  const needle = q.toLocaleLowerCase();
  const items = all.filter((c) => {
    if (f === "employers" && sides.get(c.id) !== "employer") return false;
    if (f === "candidates" && sides.get(c.id) !== "candidate") return false;
    if (!needle) return true;
    return [c.other_name, c.context_title, c.company_name, c.last_message_preview].some((x) => (x ?? "").toLocaleLowerCase().includes(needle));
  });
  const showFilters = kinds.size > 1 || f !== null;
  const href = (next: Filter | null) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (next) p.set("f", next);
    const s = p.toString();
    return s ? `/messages?${s}` : "/messages";
  };
  const filters: { key: Filter | null; label: string }[] = [
    { key: null, label: t("chat.list.filter_all") },
    { key: "employers", label: t("chat.list.filter_employers") },
    { key: "candidates", label: t("chat.list.filter_candidates") },
  ];

  return (
    <Shell>
      <div className="container-narrow py-4 md:py-6">
        <PageHeader title={t("chat.title")} subtitle={t("chat.description")} />
        {all.length ? (
          <div className="mb-4 space-y-3">
            <Form action="/messages" role="search" aria-label={t("chat.list.search_label")}>
              {f ? <input type="hidden" name="f" value={f} /> : null}
              <Input
                name="q"
                type="search"
                defaultValue={q}
                enterKeyHint="search"
                aria-label={t("chat.list.search_label")}
                placeholder={t("chat.list.search_placeholder")}
                leftIcon={<Search />}
                className="h-12 rounded-xl"
                maxLength={80}
              />
            </Form>
            {showFilters ? (
              <nav aria-label={t("chat.list.filter_label")} className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
                <ul className="flex gap-2">
                  {filters.map((x) => (
                    <li key={x.key ?? "all"} className="flex">
                      <Link
                        href={href(x.key)}
                        aria-current={f === x.key ? "page" : undefined}
                        className={cn(
                          "press inline-flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-full border px-4 text-sm font-semibold",
                          f === x.key ? "border-primary bg-primary-soft text-primary" : "border-border bg-card text-foreground hover:border-primary/50",
                        )}
                      >
                        {x.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ) : null}
          </div>
        ) : null}
        {all.length && !items.length ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-center">
            <p className="font-semibold">{t("chat.list.no_results")}</p>
            <Link href="/messages" className="mt-2 inline-flex min-h-11 items-center font-semibold text-primary hover:underline">
              {t("chat.list.clear")}
            </Link>
          </div>
        ) : (
          <ConversationList items={items} errorCode={error} audience={audience} />
        )}
      </div>
    </Shell>
  );
}
