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
 * Bosh sahifa tepasidagi rasmli oynalar: telefonda yonga suriladigan qator (keyingisi chetdan ko'rinib turadi),
 * planshet/kompyuterda — uchta ustun. Har oyna: rasm, ostida nomi va bir qator izoh; butun oyna bosiladi.
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
            <li key={w.id} className="w-[80%] max-w-sm shrink-0 snap-start sm:w-auto sm:max-w-none">
              <Link
                href={w.href}
                data-track="home_window"
                data-track-to={w.id}
                className="press group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm hover:border-primary/50"
              >
                <div className="aspect-[16/9] w-full overflow-hidden bg-primary-soft">
                  {w.image ? (
                    <Photo src={windowImageUrl(w.image)} alt="" sizes="(min-width: 640px) 33vw, 80vw" className="size-full" fallback={art} />
                  ) : (
                    art
                  )}
                </div>
                <div className="flex flex-1 flex-col px-4 py-3">
                  <span className="break-words text-lg font-bold leading-snug group-hover:text-primary">{title}</span>
                  {desc ? <span className="mt-0.5 break-words text-base leading-snug text-muted-foreground">{desc}</span> : null}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
