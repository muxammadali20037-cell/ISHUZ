import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { getEntryStats } from "@/features/landing/entry-queries";
import { getEntryMedia } from "@/features/entry/queries";
import { EntryImage } from "@/features/entry/components/entry-art";
import { IntroSlides } from "@/features/entry/components/intro-slides";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("welcome.entry.intro.slides"), robots: { index: false } };
}

const num = (n: number) => new Intl.NumberFormat("ru-RU").format(n);

/** 3–5-ekranlar: ish topish → ishchi topish → mos imkoniyatlar. Rasmlar — admin panelda almashtiriladi; sonlar — faqat haqiqiy */
export default async function IntroPage({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  const [{ t }, stats, media, sp] = await Promise.all([getT(), getEntryStats(), getEntryMedia(), searchParams]);
  const initialStep = Math.max(0, Math.min(2, (Number.parseInt(sp.s ?? "1", 10) || 1) - 1));
  const sizes = "(min-width: 640px) 384px, 100vw";
  return (
    <IntroSlides
      initialStep={initialStep}
      slides={[
        {
          title: t("welcome.entry.intro.s1_title"),
          text: t("welcome.entry.intro.s1_text"),
          stat: stats && stats.vacancies > 0 ? t("welcome.intro.s1_stat", { count: num(stats.vacancies) }) : null,
          media: <EntryImage slot="intro_jobs" media={media} sizes={sizes} className="size-full" />,
        },
        {
          title: t("welcome.entry.intro.s2_title"),
          text: t("welcome.entry.intro.s2_text"),
          stat: stats && stats.workers > 0 ? t("welcome.intro.s2_stat", { count: num(stats.workers) }) : null,
          media: <EntryImage slot="intro_workers" media={media} sizes={sizes} className="size-full" />,
        },
        {
          title: t("welcome.entry.intro.s3_title"),
          text: t("welcome.entry.intro.s3_text"),
          stat: null,
          media: <EntryImage slot="intro_ai" media={media} sizes={sizes} className="size-full" />,
        },
      ]}
    />
  );
}
