import { FileText, Film, File as FileIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { mediaKind } from "../pure";

/**
 * Portfolio fayli ko'rinishi: rasm → <img> (Supabase public URL, next/image remotePatterns sozlanmagan),
 * video → <video>, pdf/hujjat → ikonka. Server va client komponentlarda ishlaydi.
 */
export function MediaThumb({ path, url, alt, className, controls }: { path: string; url: string; alt?: string; className?: string; controls?: boolean }) {
  const kind = mediaKind(path);
  const box = cn("flex size-full items-center justify-center bg-secondary text-muted-foreground", className);
  if (kind === "image") {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={alt ?? ""} loading="lazy" className={cn("size-full object-cover", className)} />;
  }
  if (kind === "video") {
    return <video src={url} className={cn("size-full object-cover", className)} controls={controls} preload="metadata" muted playsInline />;
  }
  const Icon = kind === "pdf" ? FileText : kind === "document" ? FileText : FileIcon;
  return (
    <div className={box}>
      {kind === "pdf" || kind === "document" ? <Icon className="size-8" /> : <Film className="size-8" />}
    </div>
  );
}
