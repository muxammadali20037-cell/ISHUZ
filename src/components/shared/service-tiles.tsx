import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ServiceTile {
  key: string;
  href: string;
  label: string;
  icon: LucideIcon;
  /** kompyuterda ikkinchi qator (telefonda — faqat nom) */
  hint?: string;
  /** asosiy xizmat: belgisi to'q ko'k (qolganlari och ko'k) — ekranda bitta */
  featured?: boolean;
  track?: string;
}

/**
 * Xizmatlar to'ri: har xizmat — belgi va qisqa nom. Telefonda 4 ustun (belgi tepada, nom ostida), kompyuterda 4 ustun
 * gorizontal (belgi + nom + izoh). Bosh ekran sarlavhasi ustiga chiqib turadi.
 * "Toza" uslub (2026-10-22, egasi tanlagan A varianti): hamma belgi bitta brend rangida — och ko'k plita, ko'k chiziqli belgi;
 * faqat asosiy xizmat (`featured`) to'q ko'k. Kamalak ranglar, yaltirash va gradient yo'q.
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
              <span
                className={cn(
                  "flex size-12 shrink-0 items-center justify-center rounded-2xl",
                  it.featured ? "bg-primary text-primary-foreground" : "bg-primary-soft text-primary",
                )}
                aria-hidden
              >
                <it.icon className="size-6" strokeWidth={1.8} />
              </span>
              {/* nom plitka kengligidan chiqmaydi (max-w-full): tor ekranda (< 380 px) biroz kichikroq — so'z butun qoladi;
                  juda katta shriftda ham qo'shni plitkaga o'tmaydi (bo'g'in bo'yicha yoki qator oxirida bo'linadi) */}
              <span className="min-w-0 max-w-full lg:flex-1">
                <span className="block hyphens-auto text-2xs font-semibold leading-tight text-foreground min-[380px]:text-xs sm:text-sm">{it.label}</span>
                {it.hint ? <span className="mt-0.5 hidden text-xs leading-snug text-muted-foreground lg:block">{it.hint}</span> : null}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
