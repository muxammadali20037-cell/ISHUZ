import Form from "next/form";
import Link from "next/link";
import { ArrowRight, MapPin, Search } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
}: {
  scope: "jobs" | "workers";
  label: string;
  placeholder: string;
  /** hudud chipi: joriy hudud nomi va uni o'zgartirish manzili */
  place: { label: string; href: string };
  chips: HomeChip[];
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
        </ul>
      </div>
    </div>
  );
}
