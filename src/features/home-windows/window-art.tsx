import type { WindowArt } from "./model";

/**
 * Bosh sahifa oynalari uchun o'rnatilgan illyustratsiyalar (SVG, ~1 KB): ranglar faqat brend tokenlaridan —
 * qorong'i mavzuda ham o'qiladi, tarmoqdan rasm yuklanmaydi (Telegram ichida darhol ko'rinadi).
 */
export function WindowArtwork({ art }: { art: WindowArt }) {
  return (
    <svg viewBox="0 0 320 180" className="size-full" aria-hidden focusable="false">
      <rect width="320" height="180" className="fill-primary-soft" />
      {art === "workers" ? <Workers /> : art === "jobs" ? <Jobs /> : art === "near" ? <Near /> : art === "post" ? <Post /> : <Daily />}
    </svg>
  );
}

function Check({ x, y, r }: { x: number; y: number; r: number }) {
  return (
    <>
      <circle cx={x} cy={y} r={r} className="fill-success" />
      <path d={`M${x - r * 0.45} ${y}l${r * 0.33} ${r * 0.33} ${r * 0.6} -${r * 0.66}`} className="stroke-success-foreground" strokeWidth={r * 0.27} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </>
  );
}

/** "Endi xodim topish oson": nomzodlar, o'rtadagisi lupa ostida va tasdiqlangan */
function Workers() {
  return (
    <>
      <circle cx="282" cy="24" r="58" className="fill-primary/10" />
      <circle cx="28" cy="166" r="44" className="fill-primary/10" />
      <rect x="40" y="140" width="240" height="6" rx="3" className="fill-primary/20" />
      <circle cx="90" cy="88" r="17" className="fill-primary/35" />
      <path d="M58 140a32 32 0 0 1 64 0z" className="fill-primary/35" />
      <circle cx="230" cy="88" r="17" className="fill-primary/35" />
      <path d="M198 140a32 32 0 0 1 64 0z" className="fill-primary/35" />
      <circle cx="160" cy="80" r="21" className="fill-primary" />
      <path d="M121 140a39 39 0 0 1 78 0z" className="fill-primary" />
      <circle cx="160" cy="98" r="54" className="fill-card/25 stroke-foreground" strokeWidth="9" />
      <path d="M199 137l30 30" className="stroke-foreground" strokeWidth="14" strokeLinecap="round" />
      <Check x={206} y={54} r={15} />
    </>
  );
}

/** "Endi o'zingizga mos ish topish oson": ish kartasi, maosh, joylashuv, mos keldi */
function Jobs() {
  return (
    <>
      <circle cx="38" cy="26" r="52" className="fill-primary/10" />
      <circle cx="298" cy="170" r="62" className="fill-primary/10" />
      <rect x="80" y="42" width="176" height="112" rx="16" className="fill-primary/20" />
      <rect x="66" y="30" width="176" height="112" rx="16" className="fill-card" />
      <path d="M99 56v-6a5 5 0 0 1 5-5h10a5 5 0 0 1 5 5v6" className="stroke-primary" strokeWidth="5" fill="none" />
      <rect x="84" y="56" width="50" height="38" rx="8" className="fill-primary" />
      <rect x="84" y="71" width="50" height="5" className="fill-primary-foreground/30" />
      <rect x="146" y="58" width="78" height="10" rx="5" className="fill-foreground/80" />
      <rect x="146" y="76" width="56" height="8" rx="4" className="fill-foreground/25" />
      <rect x="84" y="108" width="84" height="20" rx="10" className="fill-success/15" />
      <rect x="94" y="115" width="52" height="6" rx="3" className="fill-success" />
      <path d="M266 34c-13 0-22 10-22 22 0 16 22 38 22 38s22-22 22-38c0-12-9-22-22-22z" className="fill-primary" />
      <circle cx="266" cy="56" r="8" className="fill-card" />
      <Check x={238} y={134} r={18} />
      <path d="M44 104l4 10 10 4-10 4-4 10-4-10-10-4 10-4z" className="fill-warning" />
    </>
  );
}

/** "Kunlik ishlar": kalendarda bir kun belgilangan, quyosh, ish kaskasi, tanga */
function Daily() {
  const rays = Array.from({ length: 8 }, (_, i) => {
    const a = (i * Math.PI) / 4;
    return { x1: 262 + Math.cos(a) * 28, y1: 46 + Math.sin(a) * 28, x2: 262 + Math.cos(a) * 36, y2: 46 + Math.sin(a) * 36 };
  });
  return (
    <>
      <circle cx="292" cy="16" r="64" className="fill-primary/10" />
      {rays.map((r, i) => (
        <line key={i} {...r} className="stroke-warning" strokeWidth="4" strokeLinecap="round" />
      ))}
      <circle cx="262" cy="46" r="20" className="fill-warning" />
      <rect x="56" y="36" width="132" height="124" rx="16" className="fill-card" />
      <path d="M56 52a16 16 0 0 1 16-16h100a16 16 0 0 1 16 16v14H56z" className="fill-primary" />
      <rect x="84" y="24" width="8" height="22" rx="4" className="fill-foreground/70" />
      <rect x="152" y="24" width="8" height="22" rx="4" className="fill-foreground/70" />
      {Array.from({ length: 12 }, (_, i) => {
        const x = 70 + (i % 4) * 28;
        const y = 80 + Math.floor(i / 4) * 24;
        return i === 5 ? null : <rect key={i} x={x} y={y} width="20" height="16" rx="4" className="fill-primary/15" />;
      })}
      <rect x="96" y="102" width="24" height="20" rx="5" className="fill-primary" />
      <path d="M102 112l4 4 8-8" className="stroke-primary-foreground" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M208 150a33 33 0 0 1 66 0z" className="fill-warning" />
      <rect x="200" y="146" width="82" height="10" rx="5" className="fill-warning" />
      <rect x="237" y="118" width="8" height="30" rx="4" className="fill-warning-foreground/30" />
      <circle cx="34" cy="148" r="15" className="fill-success" />
      <circle cx="34" cy="148" r="9" className="fill-none stroke-success-foreground/60" strokeWidth="2.5" />
    </>
  );
}

/** "Yaqin atrofda": xarita, ko'cha chiziqlari, markazda joylashuv belgisi va radius halqalari */
function Near() {
  return (
    <>
      <circle cx="300" cy="22" r="58" className="fill-primary/10" />
      <rect x="44" y="34" width="232" height="128" rx="18" className="fill-card" />
      <path d="M44 96h232M128 34v128M212 34v128" className="stroke-primary/15" strokeWidth="10" />
      <path d="M44 62c60 10 110-8 232 22" className="stroke-warning/50" strokeWidth="6" fill="none" strokeLinecap="round" />
      <circle cx="160" cy="104" r="50" className="fill-primary/10 stroke-primary/30" strokeWidth="3" />
      <circle cx="160" cy="104" r="28" className="fill-primary/15 stroke-primary/40" strokeWidth="3" />
      <path d="M160 42c-17 0-29 13-29 29 0 22 29 49 29 49s29-27 29-49c0-16-12-29-29-29z" className="fill-primary" />
      <circle cx="160" cy="71" r="11" className="fill-card" />
      <circle cx="96" cy="128" r="9" className="fill-success" />
      <circle cx="232" cy="70" r="9" className="fill-success" />
      <circle cx="238" cy="136" r="9" className="fill-success" />
    </>
  );
}

/** "Ish e'loni bering": e'lon varag'i, ustida qo'shish belgisi, karnay */
function Post() {
  return (
    <>
      <circle cx="30" cy="160" r="56" className="fill-primary/10" />
      <circle cx="296" cy="20" r="52" className="fill-primary/10" />
      <rect x="96" y="30" width="128" height="136" rx="14" className="fill-primary/20" />
      <rect x="84" y="22" width="128" height="136" rx="14" className="fill-card" />
      <rect x="102" y="44" width="70" height="10" rx="5" className="fill-foreground/80" />
      <rect x="102" y="64" width="92" height="8" rx="4" className="fill-foreground/25" />
      <rect x="102" y="80" width="80" height="8" rx="4" className="fill-foreground/25" />
      <rect x="102" y="104" width="56" height="18" rx="9" className="fill-success/15" />
      <rect x="110" y="110" width="40" height="6" rx="3" className="fill-success" />
      <circle cx="214" cy="132" r="26" className="fill-primary" />
      <path d="M214 119v26M201 132h26" className="stroke-primary-foreground" strokeWidth="7" strokeLinecap="round" />
      <path d="M244 64l26-14v44l-26-14z" className="fill-warning" />
      <rect x="232" y="64" width="14" height="16" rx="3" className="fill-warning" />
    </>
  );
}
