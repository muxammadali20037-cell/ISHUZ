import { cn } from "@/lib/utils";
import { CategoryIcon } from "./category-icon";

/**
 * Kasb tasviri: shu kasb uchun bir marta yaratilgan rasm (bo'lsa) yoki brend plitasi + soha ikonkasi (zaxira).
 * Bu odamning haqiqiy surati EMAS — `label` bilan "Kasb tasviri" deb yoziladi.
 */
export function ProfessionImage({
  url,
  icon,
  name,
  label,
  className,
  iconClassName,
}: {
  url?: string | null;
  icon?: string | null;
  name: string;
  /** masalan "Kasb tasviri" — rasm burchagida kichik yozuv (tafsilot sahifalarida); faqat rasm bo'lsa, ikonka plitasida emas */
  label?: string;
  className?: string;
  iconClassName?: string;
}) {
  return (
    <figure className={cn("relative overflow-hidden rounded-2xl bg-secondary", className)}>
      {url ? (
        // Supabase public URL (bir marta yaratilgan, keshlanadi)
        // eslint-disable-next-line @next/next/no-img-element -- kasb tasviri: bir marta yaratilib keshlangan public URL, Photo zaxirasi sifatida ham ishlatiladi
        <img src={url} alt={label ? `${name} — ${label}` : name} loading="lazy" className="size-full object-cover" />
      ) : (
        <div className="flex size-full items-center justify-center bg-primary-soft" role="img" aria-label={name}>
          <CategoryIcon name={icon} className={cn("size-1/2 max-h-16 max-w-16 text-primary", iconClassName)} />
        </div>
      )}
      {label && url ? (
        <figcaption className="absolute bottom-1.5 left-1.5 rounded-md bg-foreground/70 px-1.5 py-0.5 text-2xs font-medium leading-tight text-background">{label}</figcaption>
      ) : null}
    </figure>
  );
}
