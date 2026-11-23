"use client";

import Link from "next/link";
import { BriefcaseBusiness, ChevronRight, MapPin, Pin, UserRound } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import type { ConversationContext } from "../types";

/**
 * Suhbat tepasida qadalgan e'lon (ega, 2026-11-23: "Chatda yozish bossa — bergan e'loni qadalib tursin"): rasm (bo'lsa) yoki
 * belgi, "Qadalgan e'lon" / "Qadalgan vakansiya", sarlavha, hudud; bosilsa — e'lon sahifasi. Xabarlar ro'yxati aylansa ham
 * joyida turadi (ro'yxatdan tashqarida).
 */
export function PinnedListing({ context }: { context: ConversationContext }) {
  const { t } = useT();
  if (!context.title) return null;
  const vacancy = context.listing === "vacancy" || context.kind !== "listing";
  const Icon = vacancy ? BriefcaseBusiness : UserRound;
  const inner = (
    <>
      {context.image ? (
        // eslint-disable-next-line @next/next/no-img-element -- e'lonning tayyor rasmi (ochiq bucket), kichik ko'rinish
        <img src={context.image} alt="" width={96} height={96} loading="lazy" decoding="async" className="size-12 shrink-0 rounded-lg object-cover" />
      ) : (
        <span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-ink" aria-hidden>
          <Icon className="size-6" />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1 text-2xs font-bold uppercase tracking-wide text-primary-ink">
          <Pin className="size-3" aria-hidden /> {t(vacancy ? "chat.room.pinned_vacancy" : "chat.room.pinned_listing")}
        </span>
        <span className="block truncate text-sm font-bold text-foreground" data-pinned-title>
          {context.title}
          {context.company ? <span className="font-semibold text-muted-foreground"> · {context.company}</span> : null}
        </span>
        {context.place ? (
          <span className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="size-3 shrink-0" aria-hidden />
            <span className="truncate">{context.place}</span>
          </span>
        ) : null}
      </span>
      {context.href ? <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden /> : null}
    </>
  );
  const cls = "flex min-h-16 items-center gap-3 px-3 py-2 sm:px-4";
  return (
    <div className="border-b border-border bg-card/95" data-pinned-listing={vacancy ? "vacancy" : "worker"}>
      <div className="mx-auto w-full max-w-3xl">
        {context.href ? (
          <Link href={context.href} className={`${cls} press hover:bg-secondary/60`}>
            {inner}
          </Link>
        ) : (
          <div className={cls}>{inner}</div>
        )}
      </div>
    </div>
  );
}
