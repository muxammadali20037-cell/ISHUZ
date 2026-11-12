import { getT } from "@/lib/i18n/server";
import { MastersShell } from "./masters-shell";

/**
 * 0076 hali qo'llanmagan baza (deploy oynasi) yoki baza javob bermagan holat: buzilgan katalog yoki "0 ta e'lon" emas —
 * halol "Bo'lim tayyorlanmoqda". Kategoriyalar bo'sh kelganda bosh sahifa va qidiruv sahifasi shuni ko'rsatadi.
 */
export async function MastersUnavailable() {
  const { t } = await getT();
  return (
    <MastersShell search={false} post={false}>
      <div
        className="container-narrow py-12 text-center"
        data-masters-unavailable
      >
        <h1 className="text-2xl font-extrabold tracking-tight">
          {t("masters.unavailable_title")}
        </h1>
        <p className="mt-2 text-base text-muted-foreground">
          {t("masters.unavailable_desc")}
        </p>
      </div>
    </MastersShell>
  );
}
