import { describe, expect, it } from "vitest";
import uz from "../../../messages/uz/legal.json";
import oz from "../../../messages/oz/legal.json";
import ru from "../../../messages/ru/legal.json";
import en from "../../../messages/en/legal.json";
import vercel from "../../../vercel.json";

/**
 * Huquqiy matnlar to'rt tilda alohida yoziladi (kirill — qo'lda tuzatilgan matn, avtomatik emas). Bir tilga qo'shilgan
 * band boshqasida unutilmasin: maxfiylik siyosatida ko'rsatilgan xizmatlar (ma'lumot uzatiladigan tashkilotlar) va
 * yangilangan sana hamma tilda bir xil bo'lishi shart. 2026-11-28: kirill matnida Google va OpenAI qatorlari yo'q edi.
 */
const DOCS = { uz, oz, ru, en } as const;
const PROCESSORS = ["Supabase", "Vercel", "Google", "Telegram", "Payme", "Click", "Anthropic", "Claude", "Gemini", "OpenAI"];

describe("huquqiy matnlar — tillar mosligi", () => {
  it("yangilangan sana hamma tilda bir xil", () => {
    for (const [lang, doc] of Object.entries(DOCS)) expect(doc.updated, lang).toBe(uz.updated);
  });

  it("maxfiylik siyosati: har bir xizmat (ma'lumot oluvchi) hamma tilda nomi bilan ko'rsatilgan", () => {
    const text = (doc: typeof uz) => JSON.stringify(doc.privacy);
    for (const name of PROCESSORS) {
      expect(text(uz), `uz: ${name}`).toContain(name);
      for (const [lang, doc] of Object.entries(DOCS)) expect(text(doc as typeof uz), `${lang}: ${name}`).toContain(name);
    }
  });

  it("bo'limlar soni hamma tilda bir xil", () => {
    for (const key of ["privacy", "terms", "cookies"] as const) {
      for (const [lang, doc] of Object.entries(DOCS)) expect((doc as typeof uz)[key].sections.length, `${lang}.${key}`).toBe(uz[key].sections.length);
    }
  });

  it("maxfiylik siyosati: har bo'limdagi ro'yxat bandlari soni hamma tilda bir xil", () => {
    const bullets = (s: string) => s.split("\n").filter((l) => l.startsWith("- ")).length;
    uz.privacy.sections.forEach((section, i) => {
      for (const [lang, doc] of Object.entries(DOCS)) expect(bullets((doc as typeof uz).privacy.sections[i]![1]!), `${lang} privacy[${i}]`).toBe(bullets(section[1]!));
    });
  });

  it("maxfiylik siyosatidagi server joyi vercel.json hududi bilan bir xil (sayt va baza bir hududda)", () => {
    const CITY: Record<string, Record<keyof typeof DOCS, string>> = {
      fra1: { uz: "Germaniyada (Frankfurt)", oz: "Германияда (Франкфурт)", ru: "в Германии (Франкфурт)", en: "in Germany (Frankfurt)" },
      bom1: { uz: "Hindistonda (Mumbay)", oz: "Ҳиндистонда (Мумбай)", ru: "в Индии (Мумбаи)", en: "in India (Mumbai)" },
    };
    const region = vercel.regions[0]!;
    expect(Object.keys(CITY), "yangi hudud — shu ro'yxatga va maxfiylik siyosatiga qo'shing").toContain(region);
    for (const [lang, doc] of Object.entries(DOCS)) {
      const supabase = doc.privacy.sections[3]![1]!.split("\n").find((l) => l.startsWith("- Supabase"));
      expect(supabase, lang).toContain(CITY[region]![lang as keyof typeof DOCS]);
    }
  });
});
