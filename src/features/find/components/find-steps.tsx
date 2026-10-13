"use client";

import Link, { useLinkStatus } from "next/link";
import { useEffect, useRef, useState, useTransition, type MouseEvent, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ChevronRight, Globe2, Loader2, MapPin } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import type { Category, District, Region } from "@/lib/reference";
import type { TrailItem } from "@/features/professions/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ProfessionPicker } from "@/features/professions/components/profession-picker";
import { isCityRegion } from "@/lib/geo/city";
import { anyProfession, findHref, parseFindParams, type FindParams } from "../params";
import type { Place } from "../place";
import { NearMeButton } from "./near-me";

const bigLink = "press flex min-h-14 w-full items-center gap-3 rounded-2xl border-2 border-border bg-card px-4 py-3 text-left text-lg font-semibold hover:border-primary/50";

type Step = "profession" | "region" | "district" | "results";

/**
 * Qidiruv qadamlari (kasb → viloyat → tuman) shu sahifada almashadi: URL `history.pushState` bilan yangilanadi
 * (orqaga tugmasi, sahifani yangilash va havolani ulashish ishlaydi), serverga so'rov ketmaydi — bosish darhol javob beradi.
 * Faqat natijalar serverdan olinadi; ular kelguncha bosilgan qatorda aylanuvchi belgi ko'rinadi.
 */
export function FindSteps({
  base,
  categories,
  regions,
  districts,
  initialNode,
  myPlace = null,
}: {
  /** serverda o'qilgan URL holati (birinchi chizish) */
  base: FindParams;
  categories: Category[];
  regions: Region[];
  /** barcha faol tumanlar (ma'lumotnoma keshi); bo'sh bo'lsa — tuman qadami serverda ochiladi */
  districts: District[];
  initialNode: { id: string; trail: TrailItem[] } | null;
  /** "Yaqin atrofda" bilan eslab qolingan tuman (viloyat qadamida birinchi tanlov) */
  myPlace?: Place | null;
}) {
  const { t, name } = useT();
  const router = useRouter();
  const sp = useSearchParams();
  const cur = sp ? parseFindParams(Object.fromEntries(sp.entries())) : base;
  const [nodes, setNodes] = useState<Record<string, TrailItem[]>>(() => (initialNode ? { [initialNode.id]: initialNode.trail } : {}));
  const [pending, start] = useTransition();

  const trail = cur.p ? nodes[cur.p] : undefined;
  const region = cur.region && cur.region !== "all" && cur.region !== "remote" ? (regions.find((r) => r.slug === cur.region) ?? null) : null;
  const regionKnown = cur.region === "all" || cur.region === "remote" || !!region;
  const regionDistricts = region ? districts.filter((d) => d.region_id === region.id) : [];
  const districtKnown = cur.district === "all" || (!!cur.district && regionDistricts.some((d) => d.id === cur.district));
  const step = stepOf(cur, !!trail, regionKnown, !!region, districtKnown);
  const here = findHref(cur);

  // URL natija holatida (masalan, kasb tanlangach server javobi kutilmoqda yoki tarixdagi yozuv) — natijani serverdan olamiz
  const replaced = useRef<string | null>(null);
  useEffect(() => {
    if (step !== "results" || pending || replaced.current === here) return;
    replaced.current = here;
    router.replace(here);
  }, [step, pending, here, router]);

  /** shu sahifadagi qadam: URL yangilanadi, ekran darhol almashadi */
  const show = (href: string) => {
    window.history.pushState(null, "", href);
    window.scrollTo({ top: 0 });
  };

  const modeSummary = cur.mode === "workers" ? t("easy.search.summary_workers") : t("easy.search.summary_jobs");
  const prof = trail?.length ? name(trail.at(-1)!) : anyProfession(cur) ? (cur.mode === "jobs" && cur.pay === "daily" ? t("easy.search.daily_jobs") : t("easy.search.all_professions")) : "";

  if (step === "profession" || step === "results") {
    const title = cur.mode === "workers" ? t("easy.search.profession_workers") : t("easy.search.profession_jobs");
    return (
      <Shell back={<Link href={findHref(cur, { mode: null, p: null })}>{backLabel(t("easy.wizard.back"))}</Link>} title={cur.mode === "workers" ? t("easy.search.workers") : t("easy.search.jobs")}>
        {cur.q ? <p className="rounded-2xl border border-warning/40 bg-warning-soft px-4 py-3 text-lg">{t("easy.search.not_understood", { q: cur.q })}</p> : null}
        <div aria-busy={pending || step === "results" || undefined}>
          <ProfessionPicker
            categories={categories}
            value={null}
            initialQuery={cur.q}
            title={title}
            onChange={(picked) => {
              setNodes((m) => ({ ...m, [picked.id]: picked.trail }));
              const next = { ...cur, p: picked.id, q: "", page: 1 };
              const href = findHref(next);
              // hudud allaqachon tanlangan ("O'zgartirish" → kasb) — to'g'ridan-to'g'ri natijalarga
              if (stepOf(next, true, regionKnown, !!region, districtKnown) === "results") start(() => router.push(href));
              else show(href);
            }}
          />
        </div>
      </Shell>
    );
  }

  if (step === "region") {
    const regionHref = (slug: string) => findHref(cur, { region: slug, district: null, page: 1 });
    const placeRegion = myPlace ? regions.find((r) => r.slug === myPlace.region) : undefined;
    const myPlaceInfo = placeRegion ? { region: placeRegion, district: districts.find((d) => d.id === myPlace!.district && d.region_id === placeRegion.id) ?? null } : null;
    return (
      <Shell
        back={
          anyProfession(cur) ? (
            <Link href="/">{backLabel(t("easy.wizard.back"))}</Link>
          ) : (
            <StepLink href={findHref(cur, { p: null, region: null, district: null })} onGo={show}>
              {backLabel(t("easy.wizard.back"))}
            </StepLink>
          )
        }
        title={t("easy.search.region_title")}
        summary={[modeSummary, prof]}
      >
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {/* joylashuv bo'yicha (eng yaqin tuman) va eslab qolingan hudud — birinchi */}
          {districts.length ? (
            <li className="sm:col-span-2">
              <NearMeButton base={cur} regions={regions} districts={districts} />
            </li>
          ) : null}
          {myPlaceInfo ? (
            <li className="sm:col-span-2">
              <Link href={findHref(cur, { region: myPlaceInfo.region.slug, district: myPlaceInfo.district?.id ?? "all", page: 1 })} className={cn(bigLink, "border-primary/40")}>
                <MapPin className="size-6 shrink-0 text-primary" aria-hidden />
                <span className="flex-1">
                  <span className="block text-base font-normal text-muted-foreground">{t("easy.near.your_area")}</span>
                  <span className="block">{[name(myPlaceInfo.region), myPlaceInfo.district ? name(myPlaceInfo.district) : null].filter(Boolean).join(" · ")}</span>
                </span>
                <PendingChevron />
              </Link>
            </li>
          ) : null}
          <li className="sm:col-span-2">
            <Link href={regionHref("all")} className={cn(bigLink, "border-primary/40")}>
              <Globe2 className="size-6 shrink-0 text-primary" aria-hidden />
              <span className="flex-1">{t("easy.location.whole_country")}</span>
              <PendingChevron />
            </Link>
          </li>
          {regions.map((r) => (
            <li key={r.id}>
              {/* tumanlar ro'yxati shu sahifada (ma'lumotnoma yuklanmagan bo'lsa — serverdan) */}
              {districts.length ? (
                <StepLink href={regionHref(r.slug)} onGo={show} className={bigLink}>
                  <MapPin className="size-6 shrink-0 text-primary" aria-hidden />
                  <span className="flex-1">{name(r)}</span>
                  <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                </StepLink>
              ) : (
                <Link href={regionHref(r.slug)} className={bigLink}>
                  <MapPin className="size-6 shrink-0 text-primary" aria-hidden />
                  <span className="flex-1">{name(r)}</span>
                  <PendingChevron />
                </Link>
              )}
            </li>
          ))}
          <li className="sm:col-span-2">
            <Link href={regionHref("remote")} className={bigLink}>
              <Globe2 className="size-6 shrink-0 text-primary" aria-hidden />
              <span className="flex-1">
                <span className="block">{t("easy.location.remote")}</span>
                <span className="block text-base font-normal text-muted-foreground">{t("easy.location.remote_desc")}</span>
              </span>
              <PendingChevron />
            </Link>
          </li>
        </ul>
      </Shell>
    );
  }

  // tuman
  const city = isCityRegion(region);
  return (
    <Shell
      back={<StepLink href={findHref(cur, { region: null, district: null })} onGo={show}>{backLabel(t("easy.wizard.back"))}</StepLink>}
      title={t("easy.location.pick_district", { region: name(region!) })}
      summary={[modeSummary, prof, name(region!)]}
    >
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <li className="sm:col-span-2">
          <Link href={findHref(cur, { district: "all", page: 1 })} className={cn(bigLink, "border-primary/40")}>
            <span className="flex-1">
              <span className="block">{t(city ? "easy.location.whole_city" : "easy.location.whole_region")}</span>
              <span className="block text-base font-normal text-muted-foreground">{t(city ? "easy.location.whole_city_desc" : "easy.location.whole_region_desc")}</span>
            </span>
            <PendingChevron />
          </Link>
        </li>
        {regionDistricts.map((d) => (
          <li key={d.id}>
            <Link href={findHref(cur, { district: d.id, page: 1 })} className={bigLink}>
              <span className="flex-1">{name(d)}</span>
              <PendingChevron />
            </Link>
          </li>
        ))}
      </ul>
    </Shell>
  );
}

function stepOf(p: FindParams, hasNode: boolean, regionKnown: boolean, isRegion: boolean, districtKnown: boolean): Step {
  if ((!p.p || !hasNode) && !anyProfession(p)) return "profession";
  if (!regionKnown) return "region";
  if (isRegion && !districtKnown) return "district";
  return "results";
}

/** Natijaga olib boruvchi havola: server javobi kelguncha o'q o'rnida aylanuvchi belgi (o'lcham bir xil — siljish yo'q) */
function PendingChevron() {
  const { pending } = useLinkStatus();
  return pending ? (
    <Loader2 className="size-5 shrink-0 animate-spin text-primary" data-step-loading aria-hidden />
  ) : (
    <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
  );
}

/** Shu sahifadagi qadamga havola: oddiy bosish — URL va ekran darhol almashadi; yangi oynada ochish — odatdagidek */
function StepLink({ href, onGo, className, children }: { href: string; onGo: (href: string) => void; className?: string; children: ReactNode }) {
  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    onGo(href);
  };
  return (
    <a href={href} onClick={onClick} className={className}>
      {children}
    </a>
  );
}

function backLabel(text: string) {
  return (
    <>
      <ArrowLeft className="size-5" aria-hidden /> {text}
    </>
  );
}

function Shell({ back, title, summary, children }: { back: ReactNode; title: string; summary?: string[]; children: ReactNode }) {
  return (
    <div className="container-narrow space-y-5 py-4 text-lg sm:py-8">
      <div className="space-y-3">
        <Button asChild variant="outline" className="h-12 px-4 text-base">
          {back}
        </Button>
        <h1 className="text-2xl font-extrabold leading-tight [overflow-wrap:anywhere] sm:text-3xl">{title}</h1>
      </div>
      {summary ? <p className="rounded-2xl bg-secondary px-4 py-3 text-lg font-semibold">{summary.filter(Boolean).join(" · ")}</p> : null}
      {children}
    </div>
  );
}
