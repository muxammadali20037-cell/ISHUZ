import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Check } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { requireSession } from "@/features/auth/session";
import { getMode } from "@/features/mode/server";
import { finishEntry } from "@/features/entry/actions";
import { EntrySubmit } from "@/features/entry/components/entry-client";
import { EntryHeading, EntryScreen } from "@/features/entry/components/entry-screen";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("welcome.entry.done.title"), robots: { index: false } };
}

/**
 * 11-ekran: "Profilingiz tayyor!" — faqat profil yaratish yakunidan keladi (oqim bu yerga o'zi yo'naltirmaydi, shuning uchun
 * takrorlanmaydi). Profil hali tayyor bo'lmasa — oqimning kerakli qadamiga. "Bosh sahifaga o'tish" oqimni yopadi.
 */
export default async function EntryDonePage() {
  const [session, mode, { t }] = await Promise.all([requireSession("/start/tayyor"), getMode(), getT()]);
  const employer = mode === "employer";
  if (employer ? !session.employerOnboarded : !session.workerOnboarded) redirect("/start");
  return (
    <form action={finishEntry}>
      <EntryScreen
        footer={
          <div className="grid gap-2">
            <EntrySubmit>{t("welcome.entry.done.cta")}</EntrySubmit>
            <Link
              href={employer ? "/company/settings" : "/profile"}
              className="inline-flex h-14 items-center justify-center rounded-xl bg-primary-soft px-5 text-base font-bold text-primary hover:bg-primary-soft/70"
            >
              {t("welcome.entry.done.edit")}
            </Link>
          </div>
        }
      >
        <div className="my-auto flex flex-col items-center py-8 text-center">
          <span className="entry-done flex size-28 items-center justify-center rounded-full bg-primary text-primary-foreground" aria-hidden>
            <Check className="size-14" strokeWidth={3} />
          </span>
          <EntryHeading className="mt-8" title={t("welcome.entry.done.title")} subtitle={t("welcome.entry.done.text")} />
          <p className="mx-auto mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">
            {employer ? t("welcome.entry.done.employer_note") : t("welcome.entry.done.worker_note")}
          </p>
        </div>
      </EntryScreen>
    </form>
  );
}
