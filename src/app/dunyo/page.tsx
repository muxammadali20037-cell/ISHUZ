import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getT } from "@/lib/i18n/server";
import { requireSession } from "@/features/auth/session";
import { getMode } from "@/features/mode/server";
import { getCategories, getRegions } from "@/lib/reference";
import { createClient } from "@/lib/supabase/server";
import { getMarketCounts } from "@/features/landing/market/queries";
import { getHomePlace } from "@/features/landing/home-queries";
import { getMyInterests } from "@/features/world/queries";
import { WorldBuilder } from "@/features/world/components/world-builder";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("easy.world.page_title"), robots: { index: false } };
}

/**
 * /dunyo — "Dunyongizni yarating" (2026-11): kirgan ish qidiruvchi qiziqqan sohalarini va hududini tanlaydi; bosh sahifa
 * ("Mening dunyom") shunga moslashadi. Qayta ochilsa — tanlovni o'zgartirish. Ish beruvchi rejimida — bosh sahifaga.
 * Sayt sarlavhasi va pastki menyusiz (bitta ishga e'tibor) — telefonda va Telegram ichida to'liq ekran.
 */
export default async function WorldPage() {
  const session = await requireSession("/dunyo");
  const mode = await getMode();
  if (mode === "employer") redirect("/");
  const supabase = await createClient();
  const [{ name }, categories, regions, counts, interests, place, tg] = await Promise.all([
    getT(),
    getCategories(),
    getRegions(),
    getMarketCounts(),
    getMyInterests(session.userId),
    getHomePlace(),
    supabase.from("telegram_accounts").select("bot_started").eq("profile_id", session.userId).maybeSingle(),
  ]);
  // migratsiya (0073) qo'llanmagan bazada — oqim yo'q (yarim ishlaydigan sahifa ko'rsatilmaydi)
  if (!interests.supported) redirect("/");
  return (
    <main className="flex min-h-dvh flex-col bg-background pt-[var(--safe-top)]">
      <WorldBuilder
        // e'loni ko'p sohalar birinchi (bozorda nima bor — shu), keyin odatiy tartib
        categories={categories
          .map((c, i) => ({ id: c.id, name: name(c), icon: c.icon, count: counts?.categories[c.id] ?? null, i }))
          .sort((a, b) => (b.count ?? 0) - (a.count ?? 0) || a.i - b.i)
          .map(({ i: _i, ...c }) => c)}
        regions={regions.map((r) => ({ slug: r.slug, name: name(r) }))}
        initial={interests.categories.map((c) => c.id)}
        initialRegion={place.region?.slug ?? null}
        hasCv={!!session.workerId}
        hasTelegram={!!tg.data?.bot_started}
      />
    </main>
  );
}
