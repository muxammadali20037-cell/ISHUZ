"use client";

import Image from "next/image";
import { useState } from "react";

/**
 * Bosh ekran sarlavhasining fon surati (admin → "Kirish ekranlari" → "Bosh ekran fonlari"). Ustida — ko'k brend pardasi
 * (globals.css → .hero-scrim): oq matn har qanday suratda ham o'qiladi (AA). Surat ochilmasa — jim yo'qoladi va ostidagi ko'k
 * sirt qoladi. Sarlavha birinchi ekranda — darhol yuklanadi (priority).
 */
export function HeroBackdrop({ src }: { src: string | null }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return null;
  return (
    <>
      <span className="hero-photo" aria-hidden>
        <Image src={src} alt="" fill unoptimized priority sizes="100vw" className="object-cover" onError={() => setFailed(true)} />
      </span>
      <span className="hero-scrim" aria-hidden />
    </>
  );
}
