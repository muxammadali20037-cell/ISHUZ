"use client";

import Image from "next/image";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Foydalanuvchi yuklagan rasm (ish joyi surati, avatar). Fayl ochilmasa (o'chirilgan, karantinda, tarmoq uzilgan) — buzilgan
 * belgi va kartadan chiqib ketadigan alt-matn o'rniga `fallback` (masalan, kasb tasviri) ko'rinadi.
 * `unoptimized`: rasm yuklashda qayta kodlangan va o'lchami cheklangan; next/image hydration'dan oldingi xatoni ham ushlaydi.
 */
export function Photo({
  src,
  alt,
  sizes,
  className,
  fallback,
  children,
}: {
  src: string | null | undefined;
  alt: string;
  /** masalan "128px" yoki "(min-width: 640px) 224px, 100vw" */
  sizes: string;
  /** o'lcham va shakl (aspect, kenglik, radius) — rasm ham, zaxira ham shu joyni egallaydi */
  className?: string;
  fallback: ReactNode;
  /** rasm ustidagi yozuv (figcaption) */
  children?: ReactNode;
}) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return <>{fallback}</>;
  return (
    <figure className={cn("relative overflow-hidden bg-secondary", className)}>
      <Image src={src} alt={alt} fill unoptimized sizes={sizes} className="object-cover" onError={() => setFailed(true)} />
      {children}
    </figure>
  );
}
