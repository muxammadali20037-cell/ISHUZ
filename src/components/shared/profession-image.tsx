import { promoTheme } from "@/features/promo/card";
import { cn } from "@/lib/utils";
import { CategoryIcon } from "./category-icon";

/**
 * Kasb tasviri: shu kasb uchun bir marta yaratilgan rasm (bo'lsa) yoki soha rangi + ikonka (zaxira).
 * Bu odamning haqiqiy surati EMAS — `label` bilan "Kasb tasviri" deb yoziladi.
 */
export function ProfessionImage({
  url,
  categorySlug,
  icon,
  name,
  label,
  className,
  iconClassName,
}: {
  url?: string | null;
  categorySlug?: string | null;
  icon?: string | null;
  name: string;
  /** masalan "Kasb tasviri" — rasm burchagida kichik yozuv (tafsilot sahifalarida) */
  label?: string;
  className?: string;
  iconClassName?: string;
}) {
  const theme = promoTheme(categorySlug);
  return (
    <figure className={cn("relative overflow-hidden rounded-2xl bg-secondary", className)}>
      {url ? (
        // Supabase public URL (bir marta yaratilgan, keshlanadi)
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={label ? `${name} — ${label}` : name} loading="lazy" className="size-full object-cover" />
      ) : (
        <div className="flex size-full items-center justify-center" style={{ backgroundImage: `linear-gradient(135deg, ${theme.from}, ${theme.to})` }} role="img" aria-label={name}>
          <CategoryIcon name={icon} className={cn("size-1/2 max-h-16 max-w-16 text-white/95", iconClassName)} />
        </div>
      )}
      {label ? (
        <figcaption className="absolute bottom-1.5 left-1.5 rounded-md bg-black/55 px-1.5 py-0.5 text-[11px] font-medium leading-tight text-white">{label}</figcaption>
      ) : null}
    </figure>
  );
}
