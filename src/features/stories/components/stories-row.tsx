import { getLiveStories } from "../queries";
import { StoriesStrip } from "./stories-strip";

/**
 * Bosh sahifa tepasidagi "Ish Topdim" hikoyalari (admin → "Hikoyalar"). Faol hikoya bo'lmasa — hech narsa chizilmaydi
 * (bo'sh joy ham qolmaydi). Rejim tanlanmagan mehmonga — faqat "hammaga" deb belgilanganlar.
 */
export async function StoriesRow({ mode, className, band = false }: { mode: "seeker" | "employer" | null; className?: string; /** mehmon bosh sahifasi: hero bilan bir fonda, to'liq kenglikdagi tasma */ band?: boolean }) {
  const stories = await getLiveStories(mode);
  if (!stories.length) return null;
  const strip = <StoriesStrip stories={stories} className={className} />;
  return band ? (
    <div className="bg-hero-soft">
      <div className="container-wide pt-4">{strip}</div>
    </div>
  ) : (
    strip
  );
}
