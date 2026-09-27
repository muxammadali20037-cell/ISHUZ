import { ImageResponse } from "next/og";
import { getT } from "@/lib/i18n/server";
import { getVacancyBySlug } from "@/features/jobs/queries";
import { PROMO_SIZES, PromoCard, promoTheme, twemojiCode, type PromoFormat } from "@/features/promo/card";
import { buildPromoData } from "@/features/promo/data";

/** Faqat kerakli harflar bilan Manrope (TTF) — kirill va lotin uchun */
async function loadFont(text: string, weight: 600 | 800): Promise<ArrayBuffer | null> {
  try {
    const css = await (await fetch(`https://fonts.googleapis.com/css2?family=Manrope:wght@${weight}&text=${encodeURIComponent(text)}`, { cache: "force-cache" })).text();
    const url = css.match(/src: url\((.+?)\) format\('(opentype|truetype)'\)/)?.[1];
    if (!url) return null;
    return await (await fetch(url, { cache: "force-cache" })).arrayBuffer();
  } catch {
    return null;
  }
}

/** Kategoriya stikeri (twemoji SVG) — yuklanmasa null, karta harf bilan chiqadi */
async function loadSticker(emoji: string): Promise<string | null> {
  try {
    const res = await fetch(`https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/${twemojiCode(emoji)}.svg`, { cache: "force-cache", signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    return `data:image/svg+xml;base64,${Buffer.from(await res.arrayBuffer()).toString("base64")}`;
  } catch {
    return null;
  }
}

/**
 * GET /api/promo/vacancy/<slug>?f=square|story|og
 * RLS: ommaga faqat faol vakansiya; qoralama — faqat boshqaruvchiga (cookie sessiyasi).
 */
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const vacancy = await getVacancyBySlug(slug);
  if (!vacancy) return new Response("Not found", { status: 404 });

  const f = new URL(req.url).searchParams.get("f");
  const format: PromoFormat = f === "story" || f === "og" ? f : "square";
  const tt = await getT();
  const data = buildPromoData(vacancy, tt);

  const text = ["Ish beruvchi IB", data.title, data.company, data.categoryName, data.salary, data.place, data.schedule, ...data.tags, data.url, ...Object.values(data.labels)].join(" ");
  const [bold, semi, stickerSrc] = await Promise.all([loadFont(text, 800), loadFont(text, 600), loadSticker(promoTheme(data.categorySlug).emoji)]);
  const fonts = [
    ...(bold ? [{ name: "Manrope", data: bold, weight: 800 as const, style: "normal" as const }, { name: "Manrope", data: bold, weight: 700 as const, style: "normal" as const }] : []),
    ...(semi ? [{ name: "Manrope", data: semi, weight: 600 as const, style: "normal" as const }] : []),
  ];

  const size = PROMO_SIZES[format];
  return new ImageResponse(<PromoCard data={data} format={format} stickerSrc={stickerSrc} />, {
    ...size,
    fonts: fonts.length ? fonts : undefined,
    headers: { "Cache-Control": vacancy.status === "active" ? "public, max-age=600, s-maxage=3600" : "private, no-store" },
  });
}
