import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { getT } from "@/lib/i18n/server";
import { getDistricts, getRegions } from "@/lib/reference";
import { PLACE_COOKIE, parsePlace } from "@/features/find/place";
import { PREFS_COOKIE, parsePrefs } from "@/features/entry/prefs";
import { EntryBack, EntryHeading, EntryScreen } from "@/features/entry/components/entry-screen";
import { EntrySteps } from "@/features/entry/components/entry-steps";
import { PlaceStepForm } from "@/features/entry/components/place-step-form";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("welcome.entry.place.title"), robots: { index: false } };
}

/**
 * 06 · "Qayerda ishlashni istaysiz?" (ega "MASTER PROMPT", 2026-11-16): viloyat, tuman yoki shahar, masofaviy ish va tajriba.
 * Hudud — mavjud ib_place cookie'siga (bosh sahifa va qidiruv shuni ishlatadi), qolgani — ib_prefs. Ixtiyoriy; keyin bosh sahifa.
 */
export default async function PlaceStepPage() {
  const [{ t }, regions, districts, jar] = await Promise.all([getT(), getRegions(), getDistricts(), cookies()]);
  const place = parsePlace(jar.get(PLACE_COOKIE)?.value);
  const prefs = parsePrefs(jar.get(PREFS_COOKIE)?.value);
  const region = place && regions.some((r) => r.slug === place.region) ? place.region : "all";
  return (
    <EntryScreen
      left={
        <div className="flex items-center">
          <EntryBack href="/start/kasblar" label={t("common.actions.back")} />
          <EntrySteps current={2} total={2} label={t("welcome.entry.professions.step", { current: 2, total: 2 })} />
        </div>
      }
      right={
        <Link href="/" className="inline-flex min-h-11 items-center px-3 text-sm font-semibold text-muted-foreground hover:text-foreground" data-testid="step-skip">
          {t("welcome.entry.place.skip")}
        </Link>
      }
    >
      <EntryHeading className="pt-2" title={t("welcome.entry.place.title")} subtitle={t("welcome.entry.place.subtitle")} />
      <PlaceStepForm
        regions={regions}
        districts={districts}
        initial={{ region, district: region !== "all" && place ? place.district : "all", remote: prefs.remote, experience: prefs.experience }}
      />
    </EntryScreen>
  );
}
