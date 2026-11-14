"use client";

import { useCallback, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import { BrandMark } from "@/components/shared/brand-mark";
import { orderBySeen, SEEN_KEY, type Story } from "../model";
import { StoryViewer } from "./story-viewer";

/**
 * Ko'rilgan hikoyalar — shu qurilmada (localStorage). Tashqi "do'kon" sifatida: serverda va birinchi chizishda bo'sh
 * (gidratsiya mos keladi), keyin brauzerdagi qiymat. Xotira ishlamasa (shaxsiy rejim) — faqat shu sahifa davomida eslanadi.
 */
const listeners = new Set<() => void>();
let memory = "[]";

function snapshot(): string {
  try {
    return window.localStorage.getItem(SEEN_KEY) ?? memory;
  } catch {
    return memory;
  }
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === SEEN_KEY) cb();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

function parseSeen(raw: string): Set<string> {
  try {
    const v = JSON.parse(raw);
    return new Set(Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
  } catch {
    return new Set();
  }
}

function addSeen(id: string) {
  const seen = parseSeen(snapshot());
  if (seen.has(id)) return;
  seen.add(id);
  memory = JSON.stringify([...seen].slice(-100));
  try {
    window.localStorage.setItem(SEEN_KEY, memory);
  } catch {
    // shaxsiy rejim / to'lgan xotira — xotiradagi nusxa yetarli
  }
  for (const cb of listeners) cb();
}

/**
 * Bosh sahifa tepasidagi hikoyalar qatori: kichik doirachalar (gorizontal suriladi), sahifani itarmaydi va o'zi hech narsa
 * o'ynatmaydi — bosilgandagina to'liq ekranda ochiladi. Ko'rilmaganlar rangli halqada va oldinda (shu qurilmada eslanadi).
 */
export function StoriesStrip({ stories, className }: { stories: Story[]; className?: string }) {
  const { t } = useT();
  const raw = useSyncExternalStore(subscribe, snapshot, () => "[]");
  const seen = useMemo(() => parseSeen(raw), [raw]);
  const order = useMemo(() => orderBySeen(stories, seen), [stories, seen]);
  // ochilgan paytdagi ro'yxat "muzlatiladi": ko'rish davomida doirachalar tartibi o'zgarsa ham ko'rgich sakramaydi
  const [open, setOpen] = useState<{ list: Story[]; start: number } | null>(null);
  const triggers = useRef(new Map<string, HTMLButtonElement>());
  const returnTo = useRef<string | null>(null);
  const markSeen = useCallback((id: string) => addSeen(id), []);

  if (!order.length) return null;

  return (
    <nav aria-label={t("easy.stories.label")} data-stories className={cn("-mx-1", className)}>
      <ul className="flex gap-3 overflow-x-auto px-1 pb-1 pt-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {order.map((s, i) => {
          const unseen = !seen.has(s.id);
          return (
            <li key={s.id} className="shrink-0">
              <button
                type="button"
                ref={(el) => {
                  if (el) triggers.current.set(s.id, el);
                  else triggers.current.delete(s.id);
                }}
                onClick={() => {
                  returnTo.current = s.id;
                  setOpen({ list: order, start: i });
                }}
                data-story={s.id}
                data-story-seen={unseen ? undefined : ""}
                aria-label={t("easy.stories.open", { title: s.title })}
                className="press group flex w-[4.5rem] flex-col items-center gap-1 rounded-xl p-0.5 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span
                  className={cn(
                    "flex size-16 items-center justify-center rounded-full p-[2.5px]",
                    unseen ? "bg-primary" : "bg-border",
                  )}
                  aria-hidden
                >
                  <span className="flex size-full items-center justify-center overflow-hidden rounded-full border-2 border-card bg-primary-soft">
                    {s.posterUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- storage'dagi tayyor WebP (qayta o'lchash kerak emas)
                      <img src={s.posterUrl} alt="" loading="lazy" decoding="async" className="size-full object-cover" />
                    ) : (
                      <BrandMark className="size-9" sizes="40px" />
                    )}
                  </span>
                </span>
                <span className="line-clamp-2 w-full text-xs font-medium leading-tight text-foreground [overflow-wrap:anywhere]">{s.title}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {open !== null ? (
        <StoryViewer
          stories={open.list}
          start={open.start}
          onSeen={markSeen}
          onClose={(lastId) => {
            setOpen(null);
            // fokus — oxirgi ko'rilgan hikoyaning doirachasiga (klaviatura va ekran o'quvchi uchun)
            const el = triggers.current.get(lastId ?? returnTo.current ?? "");
            requestAnimationFrame(() => el?.focus());
          }}
        />
      ) : null}
    </nav>
  );
}
