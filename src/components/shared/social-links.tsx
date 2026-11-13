"use client";

import { Camera, Send, ThumbsUp } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import { socialLabel, type SocialKey, type SocialLink } from "@/lib/social";

const ICON: Record<SocialKey, typeof Send> = { telegram: Send, instagram: Camera, facebook: ThumbsUp };

/**
 * Rasmiy Telegram kanal va Instagram sahifasi — bosilsa yangi oynada ochiladi. `tone`: "dark" — to'q ko'k fon (yon menyu,
 * sayt pastki qismi), "light" — oq karta (kabinet, yordam). `compact` — yon menyu: faqat nom, @manzilsiz.
 */
export function SocialLinks({ links, tone = "light", compact = false, title, className }: { links: SocialLink[]; tone?: "dark" | "light"; compact?: boolean; title?: string; className?: string }) {
  const { t } = useT();
  if (!links.length) return null;
  const heading = title ?? t("common.social.title");
  return (
    <div className={className} data-social-links>
      <p className={cn("mb-1.5 text-xs font-medium", tone === "dark" ? "px-3 text-navy-muted/60" : "text-muted-foreground", !compact && "text-sm font-bold", !compact && tone === "dark" && "px-0 text-navy-foreground")}>{heading}</p>
      {/* yon menyu (tor): ikkalasi bir qatorda */}
      <ul className={cn(compact ? "grid grid-cols-2 gap-1.5" : "flex flex-wrap gap-2", compact && tone === "dark" && "px-3")} aria-label={heading}>
        {links.map((l) => {
          const Icon = ICON[l.key];
          return (
            <li key={l.key} className="min-w-0 max-w-full">
              <a
                href={l.href}
                target="_blank"
                rel="noopener noreferrer"
                data-social={l.key}
                data-track="social_open"
                data-track-to={l.key}
                aria-label={t("common.social.open", { network: socialLabel(l.key), handle: l.handle ?? "" }).trim()}
                className={cn(
                  // katta shriftda tor ekranda ham sig'adi: @manzil qisqartiriladi (to'liq — aria-label'da)
                  "press inline-flex min-h-11 max-w-full items-center gap-2 rounded-full text-sm font-semibold transition-colors",
                  compact ? "w-full justify-center px-2" : "px-3.5",
                  tone === "dark"
                    ? "bg-navy-foreground/10 text-navy-foreground hover:bg-navy-foreground/20"
                    : "border border-border bg-card text-foreground hover:border-primary/50 hover:text-primary-ink",
                )}
              >
                <Icon className={cn("size-4 shrink-0", tone === "dark" ? "text-sidebar-accent" : "text-primary-ink")} aria-hidden />
                <span className="shrink-0">{socialLabel(l.key)}</span>
                {!compact && l.handle ? <span className={cn("min-w-0 truncate font-normal", tone === "dark" ? "text-navy-muted" : "text-muted-foreground")}>{l.handle}</span> : null}
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
