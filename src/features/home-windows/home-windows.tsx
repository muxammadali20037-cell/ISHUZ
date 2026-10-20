import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import { publicEnv } from "@/lib/env";
import { Photo } from "@/components/shared/photo";
import { isBuiltinWindow, type HomeWindow } from "./model";
import { WindowArtwork } from "./window-art";

export function windowImageUrl(path: string): string {
  return `${publicEnv.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, "")}/storage/v1/object/public/${path}`;
}

/**
 * Bosh sahifa tepasidagi rasmli oynalar (my.gov.uz kabi ixcham): telefonda yonga suriladigan qator — ikkitasi to'liq,
 * uchinchisi chetdan ko'rinib turadi; rasm ostida faqat nomi (kesilmaydi). Planshet/kompyuterda — uchta ustun, nomi va qisqa izoh.
 * Butun oyna bosiladi.
 */
export async function HomeWindows({ windows }: { windows: HomeWindow[] }) {
  const { t, locale } = await getT();
  const items = windows.filter((w) => w.enabled);
  if (!items.length) return null;
  const textOf = (w: HomeWindow, field: "title" | "desc") =>
    w[field][locale] || (isBuiltinWindow(w.id) ? t(`easy.home.windows.${w.id}.${field}`) : "") || w[field].uz || "";

  return (
    <section aria-label={t("easy.home.windows.label")} className="-mx-4 sm:mx-0">
      <ul className="flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto overscroll-x-contain px-4 pb-2 [scrollbar-width:none] sm:grid sm:grid-cols-3 sm:gap-4 sm:overflow-visible sm:px-0 sm:pb-0 [&::-webkit-scrollbar]:hidden">
        {items.map((w) => {
          const title = textOf(w, "title");
          const desc = textOf(w, "desc");
          const art = <WindowArtwork art={w.art ?? "jobs"} />;
          return (
            <li key={w.id} className="w-[38%] min-w-[8.5rem] max-w-[11rem] shrink-0 snap-start sm:w-auto sm:min-w-0 sm:max-w-none">
              <Link
                href={w.href}
                data-track="home_window"
                data-track-to={w.id}
                className="press group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm hover:border-primary/50"
              >
                <div className="aspect-[3/2] w-full overflow-hidden bg-primary-soft sm:aspect-[5/2]">
                  {w.image ? (
                    <Photo src={windowImageUrl(w.image)} alt="" sizes="(min-width: 640px) 33vw, 40vw" className="size-full" fallback={art} />
                  ) : (
                    art
                  )}
                </div>
                <div className="flex flex-1 flex-col px-3 py-2.5 sm:px-4 sm:py-3">
                  <span className="break-words text-base font-bold leading-tight group-hover:text-primary sm:text-lg sm:leading-snug">{title}</span>
                  {desc ? <span className="mt-0.5 hidden break-words text-sm leading-snug text-muted-foreground sm:line-clamp-2">{desc}</span> : null}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/**
 * Ixcham variant (R-C, bosh sahifa ro'yxatidan keyin): admin sozlagan oynalar kichik qatorlar — rasm 48 px, nomi va bir
 * qator izoh. Birinchi ekranni katta rasmlar egallamaydi, admin sozlamalari esa ishlashda davom etadi.
 */
export async function HomeQuickLinks({ windows, className, stacked = false }: { windows: HomeWindow[]; className?: string; stacked?: boolean }) {
  const { t, locale } = await getT();
  const items = windows.filter((w) => w.enabled);
  if (!items.length) return null;
  const textOf = (w: HomeWindow, field: "title" | "desc") =>
    w[field][locale] || (isBuiltinWindow(w.id) ? t(`easy.home.windows.${w.id}.${field}`) : "") || w[field].uz || "";
  return (
    <section aria-label={t("easy.home.windows.label")} className={className}>
      <ul className={stacked ? "grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1" : "grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3"}>
        {items.map((w) => {
          const art = <WindowArtwork art={w.art ?? "jobs"} cover />;
          const desc = textOf(w, "desc");
          return (
            <li key={w.id} className="flex">
              <Link
                href={w.href}
                prefetch={false}
                data-track="home_window"
                data-track-to={w.id}
                className="press flex w-full min-w-0 items-center gap-3 rounded-xl border border-border bg-card p-2.5 pr-3 hover:border-primary/40"
              >
                <span className="size-12 shrink-0 overflow-hidden rounded-lg bg-primary-soft" aria-hidden>
                  {w.image ? <Photo src={windowImageUrl(w.image)} alt="" sizes="48px" className="size-full" fallback={art} /> : art}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block break-words text-base font-semibold leading-snug">{textOf(w, "title")}</span>
                  {desc ? <span className="block truncate text-sm text-muted-foreground">{desc}</span> : null}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
