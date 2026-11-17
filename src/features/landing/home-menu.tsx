import Link from "next/link";
import {
  BadgeCheck,
  ChevronRight,
  Laptop,
  MapPinned,
  Sprout,
} from "lucide-react";
import { getT } from "@/lib/i18n/server";
import {
  DAILY_ITEM,
  MASTERS_ITEM,
  mainItems,
  type MenuItem,
  type MenuMode,
} from "@/components/shared/nav-items";
import { cn } from "@/lib/utils";
import { RoleSwitchRow } from "./role-switch-row";
import type { HomeMenuLinks } from "./quick-filters";

/**
 * Bosh sahifadagi "Bo'limlar" (2026-11-17, ega: "tartibsiz — pastki menyuda bor ishlar, arizalar, xabarlar, profil;
 * profildagi sozlamalar bosh sahifada ham bor — chalkash; hamma narsa tiqilmasin, kerakli narsalar tursin").
 * Faqat boshqa joyda yo'q yo'llar — 6 ta qator: Universal ustalar, Yordamchi, Kunlik, Masofaviy, Tajribasiz (ish beruvchida —
 * Tajribali), Yaqin atrofdagi. Takrorlanmaydi: Barcha vakansiyalar / Barcha nomzodlar (pastki menyu), arizalar, xabarlar,
 * profil, saqlanganlar, sozlamalar, yordam (pastki menyu va Profil), xarita ("Yaqin atrofdagi" sahifasida).
 * Rangsiz (ega, 2026-11-17: "ranglar umuman yoqmayapti"): hamma belgi, nom va rol almashtirish bir xil, "yangi" nuqtalarsiz;
 * faqat Universal ustalar — ko'k (belgi va nomi) bilan ajratilgan.
 * Kirgan foydalanuvchi: telefon va planshetda (kompyuterda — chap yon menyu), eng tagida rolni almashtirish.
 * Mehmon: hamma ekranda (yon menyu yo'q).
 */
export async function HomeMenu({
  mode,
  guest = false,
  links,
}: {
  mode: MenuMode;
  guest?: boolean;
  links: HomeMenuLinks;
}) {
  const { t } = await getT();
  const ai = mainItems(mode).find((i) => i.key === "ai")!;
  const near: MenuItem = {
    key: "near",
    href: links.near,
    labelKey:
      mode === "employer" ? "easy.chips.emp_near" : "easy.side.menu.near_label",
    hintKey:
      mode === "employer"
        ? "easy.side.menu.e_near_hint"
        : "easy.side.menu.near_hint",
    icon: MapPinned,
    match: () => false,
  };
  const quick: MenuItem[] =
    mode === "employer"
      ? [
          { ...ai, hintKey: "easy.side.menu.ai_hint_employer" },
          {
            ...DAILY_ITEM,
            href: links.daily,
            labelKey: "easy.chips.emp_daily",
            hintKey: "easy.side.menu.e_daily_hint",
          },
          {
            key: "remote",
            href: links.remote,
            labelKey: "easy.chips.emp_remote",
            hintKey: "easy.side.menu.e_remote_hint",
            icon: Laptop,
            match: () => false,
          },
          {
            key: "exp",
            href: links.exp,
            labelKey: "easy.chips.emp_exp",
            hintKey: "easy.side.menu.e_exp_hint",
            icon: BadgeCheck,
            match: () => false,
          },
          near,
        ]
      : [
          { ...ai, hintKey: "easy.side.menu.ai_hint" },
          { ...DAILY_ITEM, href: links.daily },
          {
            key: "remote",
            href: links.remote,
            labelKey: "easy.chips.seek_remote",
            hintKey: "easy.side.menu.remote_hint",
            icon: Laptop,
            match: () => false,
          },
          {
            key: "noexp",
            href: links.exp,
            labelKey: "easy.chips.seek_noexp",
            hintKey: "easy.side.menu.noexp_hint",
            icon: Sprout,
            match: () => false,
          },
          near,
        ];
  const items: MenuItem[] = [
    { ...MASTERS_ITEM, hintKey: "easy.side.menu.masters_hint" },
    ...quick,
  ];
  const target = mode === "employer" ? "worker" : "employer";
  return (
    <nav
      aria-label={t("easy.side.label")}
      data-home-menu
      className={guest ? undefined : "lg:hidden"}
    >
      <h2 className="mb-2 px-1 text-lg font-bold">{t("easy.side.sections")}</h2>
      <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
        {items.map((item) => (
          <li key={item.key}>
            <Link
              href={item.href}
              prefetch={false}
              data-menu-item={item.key}
              {...(item.tone === "ai"
                ? {
                    "data-ai-entry": true,
                    "data-track": "ai_entry",
                    "data-track-to": "home_menu",
                  }
                : {})}
              {...(item.tone === "masters"
                ? {
                    "data-masters-entry": true,
                    "data-track": "masters_entry",
                    "data-track-to": "home_menu",
                  }
                : {})}
              className="press flex min-h-16 items-center gap-3 px-4 py-2.5 hover:bg-secondary/60"
            >
              {/* rangsiz (ega, 2026-11-17: "bosh menyudagi ranglar umuman yoqmayapti — rangni olib tashla"); faqat Universal ustalar —
                  ko'k bilan ajratilgan (ega, o'sha kuni: "faqat ustalarni ko'k rang bilan ajratib qo'y") */}
              <span
                className={cn(
                  "flex size-10 shrink-0 items-center justify-center rounded-xl",
                  item.tone === "masters" ? "bg-primary-soft text-primary-ink" : "bg-secondary text-foreground",
                )}
                aria-hidden
              >
                <item.icon className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className={cn("block text-base font-bold leading-tight", item.tone === "masters" && "text-primary-ink")}>
                  {/* uzun nomlar ("Tajriba talab qilinmaydigan ishlar") qisqartirilmaydi — ikkinchi qatorga o'tadi */}
                  {t(item.labelKey)}
                </span>
                {/* kichik harf bilan — nima qiladi */}
                <span className="mt-0.5 block text-sm leading-snug text-muted-foreground">
                  {t(item.hintKey)}
                </span>
              </span>
              <ChevronRight
                className="size-5 shrink-0 text-muted-foreground"
                aria-hidden
              />
            </Link>
          </li>
        ))}
      </ul>
      {/* eng tagida, qizilda — rolni almashtirish (ish izlovchi ↔ ish beruvchi); mehmonda — yo'q */}
      {guest ? null : (
        <RoleSwitchRow
          className="mt-3"
          tone="neutral"
          target={target}
          title={t(
            target === "employer"
              ? "easy.side.switch.to_employer"
              : "easy.side.switch.to_worker",
          )}
          hint={t(
            target === "employer"
              ? "easy.side.switch.to_employer_hint"
              : "easy.side.switch.to_worker_hint",
          )}
        />
      )}
    </nav>
  );
}
