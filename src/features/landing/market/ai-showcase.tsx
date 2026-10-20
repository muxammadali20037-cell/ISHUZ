import { Check } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { AiAvatar } from "@/components/shared/ai-avatar";
import { AiFinder } from "@/features/find/components/ai-finder";

/**
 * Mehmon bosh sahifasi: AI yordamchi bo'limi — platformaning farqi bir qarashda. Chapda: nima qiladi (3 band, faqat haqiqatda
 * bor imkoniyatlar) va "AI yordamchini sinab ko'ring" (oyna shu yerda ochiladi, ro'yxatdan o'tish shart emas). O'ngda: suhbat
 * namunasi — "Namuna" deb ochiq belgilangan (natija va son ko'rsatilmaydi: soxta e'lon yo'q). Admin AI tugmasini o'chirsa — yo'q.
 */
export async function AiShowcase() {
  const { t } = await getT();
  const points = [t("welcome.market.ai_point_1"), t("welcome.market.ai_point_2"), t("welcome.market.ai_point_3")];
  return (
    <section aria-labelledby="home-ai" className="container-app py-8 sm:py-10">
      <div className="grid grid-cols-1 items-center gap-6 rounded-2xl border border-primary/25 bg-primary-soft p-5 sm:p-8 lg:grid-cols-2 lg:gap-10">
        <div>
          <AiAvatar size="lg" />
          <h2 id="home-ai" className="mt-4 text-2xl font-extrabold tracking-tight sm:text-3xl">
            {t("welcome.market.ai_title")}
          </h2>
          <p className="mt-2 text-base leading-relaxed text-muted-foreground">{t("welcome.market.ai_desc")}</p>
          <ul className="mt-4 space-y-2">
            {points.map((p) => (
              <li key={p} className="flex items-start gap-2 text-base font-medium">
                <Check className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
                {p}
              </li>
            ))}
          </ul>
          <AiFinder defaultMode="jobs" variant="cta" className="mt-5 w-full sm:w-auto" />
        </div>

        {/* suhbat namunasi: bezak emas, tushuntirish — lekin bosilmaydi va "Namuna" deb belgilangan */}
        <figure aria-label={t("welcome.market.ai_sample")} className="rounded-2xl border border-border bg-card p-4 shadow-md sm:p-5">
          <figcaption className="mb-3 inline-flex rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">{t("welcome.market.ai_sample")}</figcaption>
          <div className="space-y-3">
            <p className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-base text-primary-foreground">{t("welcome.market.ai_sample_q")}</p>
            <div className="flex items-center gap-2">
              <AiAvatar size="sm" />
              <span className="text-sm font-bold">{t("easy.finder.assistant_title")}</span>
            </div>
            <div className="space-y-2 rounded-2xl rounded-tl-md bg-secondary px-4 py-3">
              <p className="flex flex-wrap items-center gap-1.5 text-base font-semibold">
                {t("welcome.market.ai_sample_understood")}
                {[1, 2, 3].map((i) => (
                  <span key={i} className="inline-flex min-h-7 items-center rounded-full border border-primary/25 bg-card px-2.5 text-sm font-semibold text-primary">
                    {t(`welcome.market.ai_sample_chip_${i}`)}
                  </span>
                ))}
              </p>
              <p className="text-base">{t("welcome.market.ai_sample_answer")}</p>
            </div>
          </div>
        </figure>
      </div>
    </section>
  );
}
