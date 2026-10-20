import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type TileTone = "blue" | "violet" | "green" | "orange" | "rose" | "cyan" | "indigo" | "amber";

export interface ServiceTile {
  key: string;
  href: string;
  label: string;
  icon: LucideIcon;
  tone: TileTone;
  /** kompyuterda ikkinchi qator (telefonda — faqat nom) */
  hint?: string;
  /** asosiy xizmat: belgisi yaltirab turadi */
  featured?: boolean;
  track?: string;
}

const TONE: Record<TileTone, string> = {
  blue: "badge-blue",
  violet: "badge-violet",
  green: "badge-green",
  orange: "badge-orange",
  rose: "badge-rose",
  cyan: "badge-cyan",
  indigo: "badge-indigo",
  amber: "badge-amber",
};

/**
 * Xizmatlar to'ri (super-ilovalar uslubi): har xizmat — yaltiroq rangli belgi va qisqa nom. Telefonda 4 ustun (belgi tepada,
 * nom ostida), kompyuterda 4 ustun gorizontal (belgi + nom + izoh). Bosh ekran sarlavhasi ustiga chiqib turadi (`overlap`).
 * Ranglar faqat belgida (globals.css → .badge-*); nom va izoh — oddiy matn tokenlari.
 */
export function ServiceTiles({ items, label, className }: { items: ServiceTile[]; label: string; className?: string }) {
  return (
    <nav aria-label={label} className={cn("tile-raise rounded-2xl border border-border p-2 sm:p-3", className)}>
      <ul className="rise-in grid grid-cols-4 gap-1 sm:gap-2 lg:grid-cols-4">
        {items.map((it) => (
          <li key={it.key} className="flex min-w-0">
            <Link
              href={it.href}
              prefetch={false}
              data-track={it.track}
              data-track-to={it.track ? it.key : undefined}
              className="press group flex w-full min-w-0 flex-col items-center gap-1.5 rounded-xl px-1 py-2 text-center hover:bg-secondary lg:flex-row lg:gap-3 lg:px-3 lg:text-left"
            >
              <span className={cn("badge-glossy flex size-12 shrink-0 items-center justify-center rounded-2xl transition-transform group-hover:-translate-y-0.5", TONE[it.tone], it.featured && "shine")} aria-hidden>
                <it.icon className="relative z-10 size-6" strokeWidth={2.1} />
              </span>
              <span className="min-w-0 lg:flex-1">
                <span className="block text-xs font-bold leading-tight text-foreground [overflow-wrap:anywhere] sm:text-sm">{it.label}</span>
                {it.hint ? <span className="mt-0.5 hidden text-xs leading-snug text-muted-foreground lg:block">{it.hint}</span> : null}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
