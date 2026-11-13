"use client";

import { usePathname } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import { BackLink } from "./back-link";

/** Bosh sahifalar: orqaga yo'q (ish izlovchi — "/", ish beruvchi — "/" yoki "/employer", ustalar mini-ilovasi — "/ustalar") */
const ROOTS = new Set(["/", "/employer", "/ustalar"]);

/**
 * To'g'ridan-to'g'ri (havola orqali) ochilgan sahifada "Orqaga" qayerga olib boradi: eng yaqin bo'lim sahifasi
 * (masalan, /employer/vacancies/… → /employer/vacancies), topilmasa — bosh sahifa. Ro'yxatdagi har bir yo'l — mavjud sahifa.
 */
const SECTIONS = [
  "/employer/vacancies",
  "/employer/applications",
  "/employer",
  "/jobs",
  "/cabinet",
  "/settings",
  "/ustalar",
  "/messages",
  "/applications",
  "/offers",
  "/companies",
  "/kasblar",
  "/help",
  "/workers",
  "/saved",
  "/notifications",
  "/billing",
  "/profile",
];

export function backFallback(pathname: string): string {
  let best = "/";
  for (const s of SECTIONS) {
    if (pathname.startsWith(`${s}/`) && s.length > best.length) best = s;
  }
  return best;
}

export function showGlobalBack(pathname: string | null): boolean {
  return !!pathname && !ROOTS.has(pathname.replace(/\/+$/, "") || "/");
}

/**
 * Har bir sahifa tepasida kichik "‹ Orqaga" (ega, 2026-11-13: "orqaga qaytish topolmayapti — har bir oynaning tepasida kichkina
 * orqaga chiqib tursin"). Telegram ichida brauzerning orqaga tugmasi ko'rinmaydi — shuning uchun sahifaning o'zida.
 * Sayt ichidan kelingan bo'lsa — aynan oldingi sahifaga (o'sha joyiga), aks holda — bo'lim sahifasiga (BackLink).
 * Sahifaning o'z "Orqaga"si bo'lsa (`data-page-back`) — bu yashiriladi (globals.css), ikkita bo'lmaydi.
 *
 * Joyi: `bar` — telefonda yuqori panelda, logotip oldida (birinchi ekrandagi joyni olmaydi: e'lonlar avvalgidek ko'rinadi);
 * `row` — kompyuterda sahifa tepasida alohida qator; `masters` — ustalar mini-ilovasida (o'z sarlavhasi bor) har o'lchamda qator.
 */
export function GlobalBack({ variant = "row" }: { variant?: "row" | "bar" | "masters" }) {
  const pathname = usePathname();
  const { t } = useT();
  if (!showGlobalBack(pathname)) return null;
  if (variant === "bar") {
    return (
      <div data-global-back className="-ml-2 flex shrink-0 lg:hidden">
        <BackLink
          fallback={backFallback(pathname)}
          label={t("easy.wizard.back")}
          className="inline-flex min-h-11 min-w-11 items-center justify-center gap-0.5 rounded-lg pl-1 pr-2 text-sm font-semibold text-foreground hover:bg-secondary"
        >
          <ChevronLeft className="size-5 shrink-0" aria-hidden />
          {/* katta shriftda (sarlavha 22rem dan tor) — faqat belgi (nomi aria-label'da) */}
          <span className="@max-[22rem]:hidden">{t("easy.wizard.back")}</span>
        </BackLink>
      </div>
    );
  }
  return (
    <div data-global-back className={cn(variant === "masters" ? "container-app" : "container-wide max-lg:hidden", "pt-1.5 lg:pt-2")}>
      <BackLink
        fallback={backFallback(pathname)}
        className="-ml-2 inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
      >
        <ChevronLeft className="size-4" aria-hidden /> {t("easy.wizard.back")}
      </BackLink>
    </div>
  );
}
