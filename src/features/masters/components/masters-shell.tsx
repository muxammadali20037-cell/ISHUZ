import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronLeft, LayoutList, Plus, Search, Wrench } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { getSession } from "@/features/auth/session";
import { LanguageSelect } from "@/components/shared/language-switcher";
import { Avatar } from "@/components/ui/avatar";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";
import { GlobalBack } from "@/components/shared/global-back";

/**
 * "Universal ustalar" — alohida mini-ilova qobig'i (turkuaz mavzu): o'z sarlavhasi (Ish topdim'ga qaytish, nom, qidiruv,
 * "E'lon joylash", kabinet/kirish, til), o'z footer'i. Sayt menyusi bu yerda yo'q — "mini-app" his qilinsin (egasi talabi);
 * asosiy saytga qaytish havolasi doim yuqorida.
 */
export async function MastersShell({
  children,
  search = true,
  post = true,
  className,
}: {
  children: ReactNode;
  search?: boolean;
  /** "E'lon joylash" tugmasi (forma sahifasida — yo'q) */ post?: boolean;
  className?: string;
}) {
  const [{ t }, session] = await Promise.all([getT(), getSession()]);
  const postHref = session ? "/ustalar/elon" : "/auth?next=%2Fustalar%2Felon";
  return (
    <div
      className="theme-masters flex min-h-dvh flex-col bg-background text-foreground"
      data-masters
    >
      <header
        className="sticky top-0 z-30 border-b border-border bg-card"
        style={{ paddingTop: "var(--safe-top)" }}
      >
        <div className="container-app flex min-h-14 items-center gap-2 py-1.5 sm:gap-3">
          <Link
            href="/"
            className="press inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground"
            data-masters-back
          >
            <ChevronLeft className="size-5" aria-hidden />{" "}
            <span className="hidden sm:inline">{t("masters.back")}</span>
            <span className="sm:hidden">Ish topdim</span>
          </Link>
          <Link
            href="/ustalar"
            aria-label={t("masters.name")}
            className="flex min-h-11 min-w-11 items-center justify-center gap-2 font-display text-lg font-semibold tracking-tight text-primary-ink"
          >
            <span
              className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground"
              aria-hidden
            >
              <Wrench className="size-5" />
            </span>
            <span className="hidden md:inline">{t("masters.name")}</span>
          </Link>
          {search ? (
            <form
              action="/ustalar/qidiruv"
              method="get"
              role="search"
              className="hidden min-w-0 flex-1 md:block"
            >
              <label htmlFor="masters-q" className="sr-only">
                {t("masters.search_label")}
              </label>
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <input
                  id="masters-q"
                  name="q"
                  type="search"
                  placeholder={t("masters.search_placeholder")}
                  className="h-11 w-full rounded-xl border border-input bg-background pl-10 pr-3 text-base outline-none focus:border-primary focus:ring-2 focus:ring-ring/25"
                />
              </div>
            </form>
          ) : (
            <span className="flex-1" />
          )}
          <span className="flex-1 md:hidden" />
          {post ? (
            <Link
              href={postHref}
              aria-label={t("masters.post")}
              className="press inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl bg-primary px-3 text-sm font-bold text-primary-foreground hover:bg-primary-hover sm:px-4 sm:text-base"
              data-masters-post
            >
              <Plus className="size-5" aria-hidden />{" "}
              <span className="hidden sm:inline">{t("masters.post")}</span>
            </Link>
          ) : null}
          {session ? (
            <Link
              href="/ustalar/kabinet"
              className="press flex min-h-11 items-center gap-2 rounded-xl px-1.5 hover:bg-secondary"
              aria-label={t("masters.cabinet")}
              data-masters-cabinet
            >
              <Avatar
                src={session.profile.avatar_url}
                fallback={
                  initials(
                    session.profile.first_name,
                    session.profile.last_name,
                  ) || "?"
                }
                size="sm"
              />
              <LayoutList
                className="hidden size-5 text-muted-foreground lg:block"
                aria-hidden
              />
            </Link>
          ) : null}
          <LanguageSelect className="hidden shrink-0 sm:inline-flex" />
        </div>
      </header>
      {/* ichki sahifalarda (usta, e'lon, kabinet, qidiruv) — oldingi sahifaga; mini-ilova bosh sahifasida yo'q */}
      <GlobalBack variant="masters" />
      <main className={cn("flex-1", className)}>{children}</main>
      <footer className="border-t border-border py-3 text-center text-sm text-muted-foreground">
        <div className="container-app flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
          <Link href="/" className="inline-flex min-h-11 items-center px-1 hover:underline">
            {t("masters.back")}
          </Link>
          <Link href="/privacy" className="inline-flex min-h-11 items-center px-1 hover:underline">
            {t("common.footer.privacy")}
          </Link>
          <Link href="/terms" className="inline-flex min-h-11 items-center px-1 hover:underline">
            {t("common.footer.terms")}
          </Link>
        </div>
      </footer>
    </div>
  );
}
