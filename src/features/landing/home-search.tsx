import Form from "next/form";
import Link from "next/link";
import { ArrowRight, ChevronDown, MapPin, Search, SlidersHorizontal } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AiFinder } from "@/features/find/components/ai-finder";

export interface HomeChip {
  key: string;
  href: string;
  label: string;
}

const chipCls =
  "press inline-flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-border bg-card px-3.5 text-sm font-semibold text-foreground hover:border-primary/50 hover:text-primary";

/**
 * Bosh sahifa qidiruvi: matn → /search (kasb, lavozim yoki kompaniya; serverda tushuniladi). Mijoz routeri bilan —
 * sahifa qayta yuklanmaydi; prefetch yo'q (matnli /search serverda yo'naltiriladi). Ostida — tez filtrlar (bir bosishda natija).
 */
export async function HomeSearch({
  scope,
  label,
  placeholder,
  place,
  chips,
  ai = false,
}: {
  scope: "jobs" | "workers";
  label: string;
  placeholder: string;
  /** hudud chipi: joriy hudud nomi va uni o'zgartirish manzili */
  place: { label: string; href: string };
  chips: HomeChip[];
  /** "AI bilan qidirish" — tez filtrlar qatorida (admin o'chirgan bo'lsa — yo'q) */
  ai?: boolean;
}) {
  const { t } = await getT();
  return (
    <div className="space-y-3">
      <Form action="/search" prefetch={false} role="search" aria-label={label} className="flex gap-2">
        <input type="hidden" name="mode" value={scope} />
        <div className="min-w-0 flex-1">
          <Input
            name="q"
            type="search"
            enterKeyHint="search"
            aria-label={label}
            placeholder={placeholder}
            leftIcon={<Search />}
            className="h-12 rounded-xl"
            maxLength={120}
            minLength={2}
            required
          />
        </div>
        {/* tor telefonda (<420 px) — faqat belgi: maydon kengroq, "Kasb, lavozim yoki kompaniya" to'liq ko'rinadi */}
        <Button type="submit" aria-label={t("easy.start.search_button")} className="h-12 w-12 shrink-0 px-0 text-base font-bold min-[420px]:w-auto min-[420px]:px-5">
          <ArrowRight className="size-5 min-[420px]:hidden" aria-hidden />
          <span className="hidden min-[420px]:inline">{t("easy.start.search_button")}</span>
        </Button>
      </Form>
      {/* telefonda — yonga suriladigan bitta qator (sahifa kengaymaydi), kattaroq ekranda — o'raladi */}
      <div role="group" aria-label={t("easy.start.filters_label")} className="-mx-4 sm:mx-0">
        <ul className="flex gap-2 overflow-x-auto overscroll-x-contain px-4 pb-1 [scrollbar-width:none] sm:flex-wrap sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden">
          <li className="flex">
            <Link href={place.href} prefetch={false} className={chipCls} aria-label={t("easy.start.place_label", { place: place.label })}>
              <MapPin className="size-4 shrink-0 text-primary" aria-hidden /> {place.label}
            </Link>
          </li>
          {chips.map((c) => (
            <li key={c.key} className="flex">
              {/* prefetch yo'q: chiplar ko'p, har biri alohida qidiruv — bosilganda yuklanadi */}
              <Link href={c.href} prefetch={false} className={chipCls} data-track="home_chip" data-track-to={c.key}>
                {c.label}
              </Link>
            </li>
          ))}
          {ai ? (
            <li className="flex">
              <AiFinder defaultMode={scope} locked className="border border-primary/30 bg-card" />
            </li>
          ) : null}
        </ul>
      </div>
    </div>
  );
}

const seekerChipCls =
  "press inline-flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-full border border-border bg-card px-4 text-sm font-semibold text-foreground hover:border-primary/50 hover:text-primary";

/**
 * Ish qidiruvchi qidiruvi (2026-10 redizayn): bitta blok — katta maydon "Kasb yoki ish nomi" + "Topish"; unga biriktirilgan
 * qator — "Filtrlar" (natijalar sahifasidagi barcha filtrlar) va "AI bilan qidirish". Hudud: kompyuterda shu blokda, telefonda —
 * yuqori panelda (TopBar). Qidiruv eslab qolingan hududda ishlaydi (yashirin maydonlar). Ostida — tez filtrlar (bir bosishda natija).
 */
export async function SeekerSearch({
  label,
  placeholder,
  place,
  filtersHref,
  chips,
  ai,
}: {
  label: string;
  placeholder: string;
  /** joriy hudud (eslab qolingan): nomi, tanlash manzili va qidiruvga uzatiladigan qiymatlar */
  place: { label: string; href: string; region: string | null; district: string | null };
  filtersHref: string;
  chips: HomeChip[];
  /** "AI bilan qidirish" (admin o'chirgan bo'lsa — yo'q) */
  ai: boolean;
}) {
  const { t } = await getT();
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-input bg-card transition-colors focus-within:border-primary focus-within:ring-2 focus-within:ring-ring/25">
        <Form action="/search" prefetch={false} role="search" aria-label={label} className="flex items-center gap-1 p-1">
          <input type="hidden" name="mode" value="jobs" />
          {place.region ? <input type="hidden" name="region" value={place.region} /> : null}
          {place.region && place.district ? <input type="hidden" name="district" value={place.district} /> : null}
          <label className="flex min-w-0 flex-1 cursor-text items-center gap-2 pl-2.5">
            <Search className="size-5 shrink-0 text-muted-foreground" aria-hidden />
            <input
              name="q"
              type="search"
              enterKeyHint="search"
              aria-label={label}
              placeholder={placeholder}
              maxLength={120}
              minLength={2}
              required
              className="h-12 w-full min-w-0 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground"
            />
          </label>
          <Link
            href={place.href}
            prefetch={false}
            aria-label={t("easy.start.place_label", { place: place.label })}
            className="hidden h-11 max-w-60 shrink-0 items-center gap-1.5 border-l border-border px-3 text-base font-semibold hover:text-primary md:inline-flex"
          >
            <MapPin className="size-4 shrink-0 text-primary" aria-hidden />
            <span className="truncate">{place.label}</span>
            <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          </Link>
          <Button type="submit" aria-label={t("easy.start.search_button")} className="h-11 w-11 shrink-0 px-0 text-base font-semibold min-[420px]:w-auto min-[420px]:px-5">
            <ArrowRight className="size-5 min-[420px]:hidden" aria-hidden />
            <span className="hidden min-[420px]:inline">{t("easy.start.search_button")}</span>
          </Button>
        </Form>
        {/* AI oynasi forma tashqarisida: uning ichki formasi (portal) qidiruv formasiga "submit" bo'lib tushmasin */}
        <div className="flex items-center justify-between gap-2 border-t border-border px-1">
          <Link
            href={filtersHref}
            prefetch={false}
            data-track="home_filters"
            className="press inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-foreground hover:text-primary"
          >
            <SlidersHorizontal className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            {t("easy.start.filters")}
          </Link>
          {ai ? <AiFinder defaultMode="jobs" locked /> : null}
        </div>
      </div>
      {/* telefonda — yonga suriladigan bitta qator (sahifa kengaymaydi), kattaroq ekranda — o'raladi */}
      <div role="group" aria-label={t("easy.start.filters_label")} className="-mx-4 sm:mx-0">
        <ul className="flex gap-2 overflow-x-auto overscroll-x-contain px-4 pb-0.5 [scrollbar-width:none] sm:flex-wrap sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden">
          {chips.map((c) => (
            <li key={c.key} className="flex">
              {/* prefetch yo'q: chiplar ko'p, har biri alohida qidiruv — bosilganda yuklanadi */}
              <Link href={c.href} prefetch={false} className={seekerChipCls} data-track="home_chip" data-track-to={c.key}>
                {c.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
