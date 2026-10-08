/**
 * Vakansiya reklama kartasi (next/og → PNG). Faqat flexbox va satori qo'llaydigan CSS.
 * Formatlar: square (Instagram post / Telegram), story (Reels/Stories), og (havola oldindan ko'rinishi).
 */
export type PromoFormat = "square" | "story" | "og";

export const PROMO_SIZES: Record<PromoFormat, { width: number; height: number }> = {
  square: { width: 1080, height: 1080 },
  story: { width: 1080, height: 1920 },
  og: { width: 1200, height: 630 },
};

/** Kategoriya → stiker emoji va rang */
const THEME: Record<string, { emoji: string; from: string; to: string }> = {
  it: { emoji: "💻", from: "#1d5fe0", to: "#6d28d9" },
  sales: { emoji: "🛍️", from: "#0ea5e9", to: "#1d5fe0" },
  marketing: { emoji: "📣", from: "#db2777", to: "#7c3aed" },
  design: { emoji: "🎨", from: "#f97316", to: "#db2777" },
  finance: { emoji: "📊", from: "#0f766e", to: "#1d5fe0" },
  driver: { emoji: "🚗", from: "#1e3a8a", to: "#0ea5e9" },
  logistics: { emoji: "🚚", from: "#1e40af", to: "#0891b2" },
  courier: { emoji: "🛵", from: "#ea580c", to: "#dc2626" },
  construction: { emoji: "🏗️", from: "#d97706", to: "#b45309" },
  craftsman: { emoji: "🛠️", from: "#475569", to: "#1d5fe0" },
  electrician: { emoji: "⚡", from: "#ca8a04", to: "#ea580c" },
  plumber: { emoji: "🔧", from: "#0284c7", to: "#1d4ed8" },
  mechanic: { emoji: "⚙️", from: "#334155", to: "#0f766e" },
  auto_service: { emoji: "🚘", from: "#1f2937", to: "#1d5fe0" },
  restaurant: { emoji: "👨‍🍳", from: "#ea580c", to: "#b91c1c" },
  call_center: { emoji: "🎧", from: "#7c3aed", to: "#1d5fe0" },
  office: { emoji: "💼", from: "#1d5fe0", to: "#0f172a" },
  education: { emoji: "📚", from: "#16a34a", to: "#0f766e" },
  medicine: { emoji: "🩺", from: "#0891b2", to: "#16a34a" },
  cleaning: { emoji: "🧹", from: "#0d9488", to: "#0284c7" },
  security: { emoji: "🛡️", from: "#1e293b", to: "#1e40af" },
  sewing: { emoji: "🧵", from: "#be185d", to: "#9333ea" },
  beauty: { emoji: "💅", from: "#ec4899", to: "#a21caf" },
  production: { emoji: "🏭", from: "#475569", to: "#b45309" },
  agriculture: { emoji: "🌾", from: "#65a30d", to: "#15803d" },
};
const DEFAULT_THEME = { emoji: "✨", from: "#1d5fe0", to: "#1446b0" };

export function promoTheme(categorySlug: string | null | undefined) {
  return (categorySlug && THEME[categorySlug]) || DEFAULT_THEME;
}

export interface PromoData {
  title: string;
  company: string | null;
  categorySlug: string | null;
  categoryName: string | null;
  salary: string;
  place: string | null;
  schedule: string | null;
  tags: string[];
  isGovernment: boolean;
  url: string;
  labels: { hiring: string; apply: string; government: string };
}

const SIZES = {
  square: { pad: 64, logo: 72, brand: 46, sticker: 160, emoji: 96, cat: 30, title: [92, 76, 64], company: 34, pillBig: 34, pill: 26, cta: 32, ctaUrl: 28, gap: 26 },
  story: { pad: 80, logo: 84, brand: 56, sticker: 250, emoji: 150, cat: 38, title: [118, 98, 84], company: 42, pillBig: 42, pill: 32, cta: 38, ctaUrl: 32, gap: 36 },
  og: { pad: 48, logo: 56, brand: 38, sticker: 150, emoji: 90, cat: 24, title: [64, 54, 46], company: 26, pillBig: 28, pill: 22, cta: 26, ctaUrl: 22, gap: 18 },
} as const;

/** Emoji → twemoji fayl nomi (FE0F tashlanadi): 👨‍🍳 → "1f468-200d-1f373" */
export function twemojiCode(emoji: string): string {
  return [...emoji]
    .map((c) => c.codePointAt(0)!)
    .filter((cp) => cp !== 0xfe0f)
    .map((cp) => cp.toString(16))
    .join("-");
}

/**
 * stickerSrc — kategoriya emoji-stikeri (data URI). Yuklanmasa lavozimning bosh harfi chiqadi.
 * Kichik belgilar matn emoji emas — tashqi resursga bog'liq bo'lmasin.
 */
export function PromoCard({ data, format, stickerSrc }: { data: PromoData; format: PromoFormat; stickerSrc: string | null }) {
  const theme = promoTheme(data.categorySlug);
  const z = SIZES[format];
  const og = format === "og";
  const len = data.title.length;
  const titleSize = len > 34 ? z.title[2] : len > 20 ? z.title[1] : z.title[0];
  const pill = (text: string, big = false) => (
    <div
      key={text}
      style={{
        display: "flex",
        alignItems: "center",
        padding: big ? `${Math.round(z.pillBig * 0.4)}px ${Math.round(z.pillBig * 0.75)}px` : `${Math.round(z.pill * 0.4)}px ${Math.round(z.pill * 0.8)}px`,
        borderRadius: 999,
        background: "rgba(255,255,255,0.18)",
        border: "2px solid rgba(255,255,255,0.35)",
        color: "#fff",
        fontSize: big ? z.pillBig : z.pill,
        fontWeight: 700,
      }}
    >
      {text}
    </div>
  );

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: z.pad,
        background: `linear-gradient(135deg, ${theme.from} 0%, ${theme.to} 100%)`,
        color: "#fff",
        fontFamily: "Manrope",
        position: "relative",
      }}
    >
      <div style={{ position: "absolute", right: -160, top: -160, width: 520, height: 520, borderRadius: 999, background: "rgba(255,255,255,0.10)", display: "flex" }} />
      <div style={{ position: "absolute", left: -120, bottom: -180, width: 420, height: 420, borderRadius: 999, background: "rgba(255,255,255,0.08)", display: "flex" }} />

      {/* yuqori: brend + "Ish bor" stikeri */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: z.logo, height: z.logo, borderRadius: z.logo * 0.28, background: "#fff", color: "#1d5fe0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: z.logo * 0.42, fontWeight: 800, letterSpacing: -1 }}>
            <svg width={z.logo * 0.78} height={z.logo * 0.78} viewBox="0 0 512 512" fill="none" stroke="#1d5fe0" strokeLinecap="round" strokeLinejoin="round">
              <path d="M196 168 V140 A28 28 0 0 1 224 112 H288 A28 28 0 0 1 316 140 V168" strokeWidth="40" />
              <rect x="100" y="168" width="312" height="232" rx="48" strokeWidth="40" />
              <path d="M190 284 L240 332 L326 240" strokeWidth="44" />
            </svg>
          </div>
          <div style={{ display: "flex", fontSize: z.brand, fontWeight: 800, letterSpacing: -1 }}>Ish topdim</div>
        </div>
        <div style={{ display: "flex", transform: "rotate(6deg)", background: "#fde047", color: "#0f172a", padding: `${z.brand * 0.3}px ${z.brand * 0.7}px`, borderRadius: 999, fontSize: z.brand * 0.72, fontWeight: 800, boxShadow: "0 12px 30px rgba(0,0,0,0.25)" }}>
          {data.labels.hiring}
        </div>
      </div>

      {/* markaz: emoji-stiker + sarlavha */}
      <div style={{ display: "flex", flexDirection: og ? "row" : "column", alignItems: og ? "center" : "flex-start", gap: z.gap }}>
        <div
          style={{
            width: z.sticker,
            height: z.sticker,
            borderRadius: z.sticker * 0.28,
            background: "rgba(255,255,255,0.95)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: z.emoji,
            transform: "rotate(-5deg)",
            boxShadow: "0 24px 60px rgba(0,0,0,0.25)",
            flexShrink: 0,
          }}
        >
          {stickerSrc ? (
            // eslint-disable-next-line @next/next/no-img-element -- satori (next/og) faqat <img> qabul qiladi
            <img src={stickerSrc} width={z.emoji} height={z.emoji} alt="" />
          ) : (
            <div style={{ display: "flex", fontSize: z.emoji, fontWeight: 800, color: theme.from }}>{data.title.slice(0, 1).toUpperCase()}</div>
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, ...(og ? { flex: 1 } : { width: "100%" }) }}>
          {data.categoryName && !og ? <div style={{ display: "flex", fontSize: z.cat, fontWeight: 600, opacity: 0.85 }}>{data.categoryName}</div> : null}
          <div style={{ display: "flex", fontSize: titleSize, fontWeight: 800, lineHeight: 1.05, letterSpacing: -2 }}>{data.title}</div>
          {data.company ? (
            <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: z.company, fontWeight: 600, opacity: 0.92 }}>
              {data.company}
              {data.isGovernment ? pill(data.labels.government) : null}
            </div>
          ) : null}
        </div>
      </div>

      {/* shartlar */}
      <div style={{ display: "flex", flexDirection: "column", gap: z.gap * 0.6 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
          {pill(data.salary, true)}
          {data.place ? pill(data.place, true) : null}
        </div>
        {!og ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
            {data.schedule ? pill(data.schedule) : null}
            {data.tags.slice(0, format === "story" ? 4 : 2).map((tag) => pill(tag))}
          </div>
        ) : null}
      </div>

      {/* pastki CTA */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#fff", color: "#0f172a", borderRadius: z.cta, padding: `${z.cta * 0.6}px ${z.cta}px` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{ display: "flex", fontSize: z.cta, fontWeight: 800 }}>{data.labels.apply}</div>
          <div style={{ display: "flex", fontSize: z.ctaUrl, fontWeight: 700, color: "#1d5fe0" }}>{data.url}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: z.cta * 1.8, height: z.cta * 1.8, borderRadius: 999, background: "#1d5fe0", color: "#fff", fontSize: z.cta * 1.1, fontWeight: 800 }}>→</div>
      </div>
    </div>
  );
}
