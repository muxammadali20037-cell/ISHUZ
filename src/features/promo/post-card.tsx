/**
 * Kanal posti rasmi (next/og → PNG, 1200×800): FAQAT ish nomi, maosh, joylashuv va kompaniya nomi; ishchi e'loni (2026-11-17,
 * ega: "e'lon joylandimi — shunaqa rasm bo'lib kelsin") — kasbi, tajribasi, joyi, kutilayotgan maosh va "ISHCHI" yorlig'i
 * (ega, 2026-11-16: "rasmli qil prosta, rasmda faqat ish nomi, maoshi, lokatsiyasi, kompaniya nomi bo'lsin").
 * Odam chizmasi, logotip, sayt nomi va havola YO'Q (egasi AI rasm so'ragan bo'lsa — fon shu surat, `photo`). Faqat flexbox va satori qo'llaydigan CSS; belgilar — chiziqli SVG
 * (matn emoji emas). Ranglar — dizayn tizimi palitrasi (asosiy #1558D6, ikkilamchi #EAF1FF).
 * 2026-11-18 (ega: "kanalda ishchimi u ish beruvchimi bilib bo'lmadi"): vakansiya — ko'k fon va "VAKANSIYA · ishchi kerak",
 * ishchi e'loni — yashil fon va "ISHCHI · ish qidiryapti"; yorliq oq, katta, belgisi bilan — bir qarashda ajraladi.
 */
export const POST_SIZE = { width: 1200, height: 800 } as const;
const PAD = 72;

export interface PostCardData {
  title: string;
  company: string | null;
  place: string | null;
  salary: string;
  /** turi: vakansiya (ko'k) yoki ishchi e'loni (yashil) — standart vakansiya */
  kind?: "vacancy" | "worker";
  /** tepadagi yorliq: "VAKANSIYA · ishchi kerak" / "ISHCHI · ish qidiryapti" */
  badge?: string | null;
  /** ishchi e'loni: tajriba qatori (kompaniya o'rnida) */
  experience?: string | null;
  /**
   * E'lon rasmi (AI, egasi "Ha" degan bo'lsa; 2026-11-20): butun fon — shu surat, chap tomoni to'q soya bilan (matn o'qilsin).
   * Yozuvlar baribir shablondan (AI harflarni xato chizadi).
   */
  photo?: string | null;
}

const BLUE = "#1558D6";
const BLUE_SOFT = "#EAF1FF";
const INK = "#101828";
const GREEN = "#16A36A";
/** ishchi e'loni foni: oq matn bilan kontrast 5.3:1 */
const WORKER_BG = "#0F7B53";
const WORKER_SOFT = "#E3F6EC";

/** Lucide belgilari (ISC) — 24×24 chiziqli */
function Icon({ name, size, color }: { name: "building" | "pin" | "money" | "briefcase" | "user"; size: number; color: string }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: color, strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (name === "building")
    return (
      <svg {...common}>
        <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" />
        <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" />
        <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" />
        <path d="M10 6h4M10 10h4M10 14h4M10 18h4" />
      </svg>
    );
  if (name === "briefcase")
    return (
      <svg {...common}>
        <path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
        <rect width="20" height="14" x="2" y="6" rx="2" />
      </svg>
    );
  if (name === "user")
    return (
      <svg {...common}>
        <circle cx="12" cy="8" r="5" />
        <path d="M20 21a8 8 0 0 0-16 0" />
      </svg>
    );
  if (name === "pin")
    return (
      <svg {...common}>
        <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" />
        <circle cx="12" cy="10" r="3" />
      </svg>
    );
  return (
    <svg {...common}>
      <rect width="20" height="12" x="2" y="6" rx="2" />
      <circle cx="12" cy="12" r="2" />
      <path d="M6 12h.01M18 12h.01" />
    </svg>
  );
}

/** Uzun matn qisqartiriladi (rasmga sig'sin) */
export function clip(s: string, max: number): string {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

/** Sarlavha uzunligiga qarab o'lcham: qisqa — katta, uzun — kichikroq (3 qatordan oshmasin) */
export function postTitleSize(title: string): number {
  const n = title.length;
  return n <= 18 ? 92 : n <= 32 ? 78 : n <= 50 ? 66 : 60;
}

export function PostCard({ data }: { data: PostCardData }) {
  const title = clip(data.title, 70);
  const worker = data.kind === "worker";
  const bg = worker ? WORKER_BG : BLUE;
  const soft = worker ? WORKER_SOFT : BLUE_SOFT;
  const row = (icon: "building" | "pin" | "briefcase", text: string) => (
    <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 72, height: 72, borderRadius: 20, background: "rgba(255,255,255,0.16)", flexShrink: 0 }}>
        <Icon name={icon} size={40} color="#FFFFFF" />
      </div>
      <div style={{ display: "flex", fontSize: 44, fontWeight: 600, color: soft, lineHeight: 1.15 }}>{clip(text, 44)}</div>
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
        padding: PAD,
        background: bg,
        color: "#FFFFFF",
        fontFamily: "Manrope",
        position: "relative",
      }}
    >
      {data.photo ? (
        <>
          {/* satori absolyut joylashuvni ichki (padding'siz) qutidan hisoblaydi — qatlamlar padding qadar chapga/tepaga surilgan */}
          {/* eslint-disable-next-line @next/next/no-img-element -- next/og (satori) faqat oddiy img */}
          <img src={data.photo} alt="" width={POST_SIZE.width} height={POST_SIZE.height} style={{ position: "absolute", left: -PAD, top: -PAD, width: POST_SIZE.width, height: POST_SIZE.height, objectFit: "cover" }} />
          {/* chapdan o'ngga soya: matn har qanday suratda o'qiladi; pastda ham bir oz (maosh pilyulasi) */}
          <div style={{ position: "absolute", left: -PAD, top: -PAD, width: POST_SIZE.width, height: POST_SIZE.height, display: "flex", backgroundImage: "linear-gradient(90deg, rgba(8,15,30,0.88) 0%, rgba(8,15,30,0.72) 38%, rgba(8,15,30,0.18) 70%, rgba(8,15,30,0) 100%)" }} />
          <div style={{ position: "absolute", left: -PAD, top: POST_SIZE.height - 260 - PAD, width: POST_SIZE.width, height: 260, display: "flex", backgroundImage: "linear-gradient(0deg, rgba(8,15,30,0.55) 0%, rgba(8,15,30,0) 100%)" }} />
        </>
      ) : (
        <>
          {/* yumshoq bezak doiralari (matn emas) */}
          <div style={{ position: "absolute", right: -180, top: -200, width: 560, height: 560, borderRadius: 999, background: "rgba(255,255,255,0.07)", display: "flex" }} />
          <div style={{ position: "absolute", right: 120, bottom: -260, width: 420, height: 420, borderRadius: 999, background: "rgba(255,255,255,0.05)", display: "flex" }} />
        </>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
        {data.badge ? (
          <div style={{ display: "flex" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 34, fontWeight: 800, letterSpacing: 1, color: bg, background: "#FFFFFF", borderRadius: 999, padding: "12px 30px 12px 22px" }}>
              <Icon name={worker ? "user" : "briefcase"} size={36} color={bg} />
              {clip(data.badge.toUpperCase(), 40)}
            </div>
          </div>
        ) : null}
        <div style={{ display: "flex", fontSize: data.photo ? Math.min(postTitleSize(title), 78) : postTitleSize(title), fontWeight: 800, lineHeight: 1.08, letterSpacing: -2, maxWidth: data.photo ? 720 : 1000 }}>{title}</div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
        {data.company ? row("building", data.company) : null}
        {data.experience ? row("briefcase", data.experience) : null}
        {data.place ? row("pin", data.place) : null}
      </div>

      <div style={{ display: "flex" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20, background: "#FFFFFF", borderRadius: 24, padding: "22px 34px" }}>
          <Icon name="money" size={48} color={GREEN} />
          <div style={{ display: "flex", fontSize: 54, fontWeight: 800, color: INK, letterSpacing: -1 }}>{clip(data.salary, 34)}</div>
        </div>
      </div>
    </div>
  );
}
