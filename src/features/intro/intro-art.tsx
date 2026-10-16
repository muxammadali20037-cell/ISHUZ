/** Tanishtiruvning 3-qadami: ishchi kartasi va ish kartasi bir-biriga mos keldi (WindowArtwork uslubida, faqat brend tokenlari) */
export function MatchArt() {
  return (
    <svg viewBox="0 0 320 200" preserveAspectRatio="xMidYMid slice" className="size-full" aria-hidden focusable="false">
      <rect width="320" height="200" className="fill-primary-soft" />
      <circle cx="40" cy="30" r="56" className="fill-primary/10" />
      <circle cx="292" cy="182" r="64" className="fill-primary/10" />
      {/* ishchi */}
      <rect x="28" y="52" width="104" height="96" rx="16" className="fill-card" />
      <circle cx="80" cy="84" r="16" className="fill-primary/35" />
      <path d="M54 124a26 26 0 0 1 52 0z" className="fill-primary/35" />
      <rect x="48" y="132" width="64" height="6" rx="3" className="fill-foreground/20" />
      {/* ish */}
      <rect x="188" y="52" width="104" height="96" rx="16" className="fill-card" />
      <path d="M226 78v-5a5 5 0 0 1 5-5h18a5 5 0 0 1 5 5v5" className="stroke-primary" strokeWidth="5" fill="none" />
      <rect x="214" y="78" width="52" height="36" rx="8" className="fill-primary" />
      <rect x="214" y="93" width="52" height="5" className="fill-primary-foreground/30" />
      <rect x="208" y="124" width="64" height="6" rx="3" className="fill-foreground/20" />
      <rect x="220" y="134" width="40" height="6" rx="3" className="fill-success/60" />
      {/* bog'lanish va belgi */}
      <path d="M134 100h52" className="stroke-primary" strokeWidth="5" strokeDasharray="7 7" strokeLinecap="round" />
      <circle cx="160" cy="100" r="22" className="fill-success" />
      <path d="M150 100l7 7 13-14" className="stroke-success-foreground" strokeWidth="5.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      {/* uchqunlar */}
      <path d="M160 34l4 10 10 4-10 4-4 10-4-10-10-4 10-4z" className="fill-primary" />
      <path d="M118 160l2.5 6 6 2.5-6 2.5-2.5 6-2.5-6-6-2.5 6-2.5z" className="fill-primary/60" />
      <path d="M206 164l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" className="fill-primary/60" />
    </svg>
  );
}
