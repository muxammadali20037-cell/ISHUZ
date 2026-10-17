import type { Locale } from "@/lib/i18n/config";

/**
 * Til tanlash kartalaridagi bayroqlar (soddalashtirilgan SVG): emoji bayroq Windows'da harf bo'lib ko'rinadi.
 * Ranglar — davlat bayroqlarining rasmiy ranglari (brend tokeni emas; brand-guard istisnosida).
 */
export function LocaleFlag({ locale }: { locale: Locale }) {
  return (
    <svg viewBox="0 0 30 20" className="h-5 w-7 shrink-0 overflow-hidden rounded-xs ring-1 ring-border" aria-hidden focusable="false">
      {locale === "ru" ? <Russia /> : locale === "en" ? <UnitedKingdom /> : <Uzbekistan />}
    </svg>
  );
}

function Uzbekistan() {
  return (
    <>
      <rect width="30" height="20" fill="#1EB53A" />
      <rect width="30" height="13.6" fill="#CE1126" />
      <rect width="30" height="13" fill="#FFFFFF" />
      <rect width="30" height="6.4" fill="#CE1126" />
      <rect width="30" height="6" fill="#0099B5" />
      <circle cx="5" cy="3" r="2.1" fill="#FFFFFF" />
      <circle cx="5.8" cy="3" r="1.8" fill="#0099B5" />
    </>
  );
}

function Russia() {
  return (
    <>
      <rect width="30" height="20" fill="#D52B1E" />
      <rect width="30" height="13.34" fill="#0039A6" />
      <rect width="30" height="6.67" fill="#FFFFFF" />
    </>
  );
}

function UnitedKingdom() {
  return (
    <>
      <rect width="30" height="20" fill="#012169" />
      <path d="M0 0L30 20M30 0L0 20" stroke="#FFFFFF" strokeWidth="4" />
      <path d="M0 0L30 20M30 0L0 20" stroke="#C8102E" strokeWidth="1.6" />
      <path d="M15 0V20M0 10H30" stroke="#FFFFFF" strokeWidth="6" />
      <path d="M15 0V20M0 10H30" stroke="#C8102E" strokeWidth="3.4" />
    </>
  );
}
