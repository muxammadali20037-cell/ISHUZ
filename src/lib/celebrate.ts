/**
 * Muvaffaqiyatdan keyin "pushka otilgandek" konfetti: ekran tepasining ikki burchagidan rangli qog'ozchalar otiladi.
 * Kutubxonasiz, bitta vaqtinchalik <canvas>; 3 soniyada o'zi yo'qoladi. "Harakatni kamaytirish" yoqilgan bo'lsa — ko'rsatilmaydi.
 */
const COLORS = ["#2563eb", "#16a34a", "#f59e0b", "#ef4444", "#a855f7", "#06b6d4", "#facc15"];

interface Piece {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  rot: number;
  vr: number;
  color: string;
  shape: 0 | 1;
}

export function celebrate(): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

  const canvas = document.createElement("canvas");
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.setAttribute("aria-hidden", "true");
  Object.assign(canvas.style, { position: "fixed", inset: "0", width: "100%", height: "100%", pointerEvents: "none", zIndex: "9999" });
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    canvas.remove();
    return;
  }
  ctx.scale(dpr, dpr);

  const pieces: Piece[] = [];
  const burst = (x: number, dir: 1 | -1) => {
    for (let i = 0; i < 70; i++) {
      const speed = 7 + Math.random() * 9;
      const angle = (Math.PI / 180) * (25 + Math.random() * 45);
      pieces.push({
        x,
        y: -10,
        vx: dir * Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed * 0.6 + Math.random() * 2,
        size: 6 + Math.random() * 6,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.3,
        color: COLORS[(Math.random() * COLORS.length) | 0] ?? "#2563eb",
        shape: Math.random() < 0.5 ? 0 : 1,
      });
    }
  };
  burst(0, 1);
  burst(w, -1);

  // Qisqa tebranish (Telegram ichida) — "otildi" hissi
  try {
    (window as unknown as { Telegram?: { WebApp?: { HapticFeedback?: { notificationOccurred?: (t: string) => void } } } }).Telegram?.WebApp?.HapticFeedback?.notificationOccurred?.("success");
  } catch {
    /* ixtiyoriy */
  }

  const start = performance.now();
  const frame = (now: number) => {
    const elapsed = now - start;
    ctx.clearRect(0, 0, w, h);
    const fade = elapsed > 2200 ? Math.max(0, 1 - (elapsed - 2200) / 800) : 1;
    ctx.globalAlpha = fade;
    for (const p of pieces) {
      p.vy += 0.25;
      p.vx *= 0.985;
      p.vy *= 0.985;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      if (p.shape === 0) ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      else {
        ctx.beginPath();
        ctx.arc(0, 0, p.size / 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    if (elapsed < 3000) requestAnimationFrame(frame);
    else canvas.remove();
  };
  requestAnimationFrame(frame);
}

const PENDING_KEY = "ib_celebrate";

/** Sahifa almashadigan holatlar uchun (redirect): keyingi sahifa ochilganda konfetti otiladi */
export function celebrateAfterNavigation(): void {
  try {
    sessionStorage.setItem(PENDING_KEY, "1");
  } catch {
    /* ixtiyoriy */
  }
}

export function consumePendingCelebration(): boolean {
  try {
    if (sessionStorage.getItem(PENDING_KEY)) {
      sessionStorage.removeItem(PENDING_KEY);
      return true;
    }
  } catch {
    /* ixtiyoriy */
  }
  return false;
}
