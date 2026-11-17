import Link from "next/link";
import {
  BadgeCheck,
  ChevronRight,
  Laptop,
  MapPin,
  Search,
  Sprout,
  UsersRound,
} from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { unreadCounts } from "@/components/shared/unread-counts";
import {
  DAILY_ITEM,
  MASTERS_ITEM,
  MORE_ITEMS,
  mainItems,
  type MenuItem,
  type MenuMode,
} from "@/components/shared/nav-items";
import { NewDot } from "@/components/shared/new-badge";
import { TINT_TILE, tintFor } from "@/components/shared/tints";
import { cn } from "@/lib/utils";
import { RoleSwitchRow } from "./role-switch-row";
import type { HomeMenuLinks } from "./quick-filters";

/**
 * Bosh sahifadagi "Bo'limlar" ro'yxati (2026-11-15; 2026-11-17 ega: "kunlik, masofaviy, tajriba — hammasini bo'limlarga qo'sh;
 * eng tepada Universal ustalar, keyin Barcha vakansiyalar, Yordamchi, Kunlik, Masofaviy… — hammasi bir qatorda; E'lon joylash
 * bo'limlardan olib tashlansin — tepada katta tugma bor"). Har qatorda kichik harf bilan nima ekani.
 * Kirgan foydalanuvchi: telefon va planshetda (kompyuterda — chap yon menyu), eng tagida qizilda rolni almashtirish.
 * Mehmon: hamma ekranda (yon menyu yo'q), shaxsiy bo'limlarsiz (arizalar, xabarlar, profil — kirgandan keyin).
 * Bo'limlar — nav-items.ts (yon menyu bilan bitta manba); hisoblagichlar — haqiqiy o'qilmaganlar.
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
  const [{ t }, counts] = await Promise.all([
    getT(),
    guest ? Promise.resolve(null) : unreadCounts(),
  ]);
  const main = mainItems(mode);
  const ai = main.find((i) => i.key === "ai")!;
  // shaxsiy bo'limlar (arizalar, saqlanganlar, xabarlar, profil, kompaniya) — faqat kirganda
  const personal = new Set([
    "applications",
    "saved",
    "messages",
    "profile",
    "my_vacancies",
    "company",
  ]);
  const rest = main.filter(
    (i) =>
      !["ai", "jobs", "candidates"].includes(i.key) &&
      (!guest || !personal.has(i.key)),
  );
  const more = guest ? MORE_ITEMS.filter((i) => i.key === "help") : MORE_ITEMS;
  const quick: MenuItem[] =
    mode === "employer"
      ? [
          {
            key: "candidates",
            href: links.all,
            labelKey: "easy.side.menu.e_candidates",
            hintKey: "easy.side.menu.e_candidates_hint",
            icon: UsersRound,
            match: () => false,
          },
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
          {
            key: "near",
            href: links.near,
            labelKey: "easy.chips.emp_near",
            hintKey: "easy.side.menu.e_near_hint",
            icon: MapPin,
            match: () => false,
          },
        ]
      : [
          {
            key: "jobs",
            href: links.all,
            labelKey: "easy.side.menu.jobs_label",
            hintKey: "easy.side.hint.jobs",
            icon: Search,
            match: () => false,
          },
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
          {
            key: "near",
            href: links.near,
            labelKey: "easy.chips.seek_near",
            hintKey: "easy.side.menu.near_hint",
            icon: MapPin,
            match: () => false,
          },
        ];
  const items: MenuItem[] = [
    { ...MASTERS_ITEM, hintKey: "easy.side.menu.masters_hint" },
    ...quick,
    ...rest,
    ...more,
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
        {items.map((item, i) => {
          const badge = item.badgeKey ? counts?.[item.badgeKey] : undefined;
          return (
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
                {...(item.tone === "post"
                  ? { "data-track": "post_start", "data-track-to": "home_menu" }
                  : {})}
                className="press flex min-h-16 items-center gap-3 px-4 py-2.5 hover:bg-secondary/60"
              >
                <span
                  className={cn(
                    "flex size-10 shrink-0 items-center justify-center rounded-xl",
                    item.tone === "post"
                      ? "brand-fill shadow-glow"
                      : item.tone === "ai"
                        ? "bg-ai-soft text-ai"
                        : item.tone === "masters"
                          ? "theme-masters bg-primary-soft text-primary-ink"
                          : TINT_TILE[tintFor(item.key, i)],
                  )}
                  aria-hidden
                >
                  <item.icon className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className={cn(
                      "flex items-center gap-1.5 text-base font-bold leading-tight",
                      item.tone === "ai" && "text-ai",
                      item.tone === "masters" &&
                        "theme-masters text-primary-ink",
                      item.tone === "post" && "text-primary-ink",
                    )}
                  >
                    {/* uzun nomlar ("Tajriba talab qilinmaydigan ishlar") qisqartirilmaydi — ikkinchi qatorga o'tadi */}
                    <span className="min-w-0">{t(item.labelKey)}</span>
                    {item.fresh ? <NewDot feature={item.fresh} /> : null}
                  </span>
                  {/* kichik harf bilan — nima qiladi */}
                  <span className="mt-0.5 block text-sm leading-snug text-muted-foreground">
                    {t(item.hintKey)}
                  </span>
                </span>
                {badge ? (
                  <span className="flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full bg-destructive px-1.5 text-xs font-bold text-destructive-foreground">
                    {badge > 99 ? "99+" : badge}
                  </span>
                ) : null}
                <ChevronRight
                  className="size-5 shrink-0 text-muted-foreground"
                  aria-hidden
                />
              </Link>
            </li>
          );
        })}
      </ul>
      {/* eng tagida, qizilda — rolni almashtirish (ish izlovchi ↔ ish beruvchi); mehmonda — yo'q */}
      {guest ? null : (
        <RoleSwitchRow
          className="mt-3"
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
