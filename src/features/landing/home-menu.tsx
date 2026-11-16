import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { unreadCounts } from "@/components/shared/unread-counts";
import { DAILY_ITEM, MASTERS_ITEM, MORE_ITEMS, POST_ITEM, mainItems, type MenuItem, type MenuMode } from "@/components/shared/nav-items";
import { NewDot } from "@/components/shared/new-badge";
import { TINT_TILE, tintFor } from "@/components/shared/tints";
import { cn } from "@/lib/utils";
import { RoleSwitchRow } from "./role-switch-row";

/**
 * Telefon va planshetdagi bosh sahifa menyusi (2026-11-15, ega: "telefonda kirganda kategoriyalar chiqsin — xuddi chap
 * menyudagidek; har birining oldida kichik harf bilan nima ekani: «… ko'rish»; eng tagida qizilda rolni o'zgartirish").
 * Kompyuterda (lg+) yo'q — u yerda chap yon menyu bor. Faqat kirgan foydalanuvchiga chiziladi (chaqiruvchi tekshiradi).
 * Bo'limlar — nav-items.ts (yon menyu bilan bitta manba); hisoblagichlar — haqiqiy o'qilmaganlar.
 */
export async function HomeMenu({ mode }: { mode: MenuMode }) {
  const [{ t }, counts] = await Promise.all([getT(), unreadCounts()]);
  // tartib (ega, 2026-11-17): E'lon joylash → Yordamchi (sun'iy intellekt) → Universal ustalar → Barcha vakansiyalar →
  // Kunlik ish → qolganlari ketma-ket; ish beruvchida: Vakansiya joylash → Yordamchi → ustalar → qolganlari
  const main = mainItems(mode);
  const ai = main.find((i) => i.key === "ai")!;
  const rest = main.filter((i) => i.key !== "ai" && i.key !== "jobs");
  const jobs = main.find((i) => i.key === "jobs");
  const items: MenuItem[] =
    mode === "employer"
      ? [POST_ITEM(mode), { ...ai, hintKey: "easy.side.menu.ai_hint_employer" }, MASTERS_ITEM, ...rest, ...MORE_ITEMS]
      : [
          POST_ITEM(mode),
          { ...ai, hintKey: "easy.side.menu.ai_hint" },
          MASTERS_ITEM,
          ...(jobs ? [{ ...jobs, labelKey: "easy.side.menu.jobs_label" }] : []),
          DAILY_ITEM,
          ...rest,
          ...MORE_ITEMS,
        ];
  const target = mode === "employer" ? "worker" : "employer";
  return (
    <nav aria-label={t("easy.side.label")} data-home-menu className="lg:hidden">
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
                {...(item.tone === "ai" ? { "data-ai-entry": true, "data-track": "ai_entry", "data-track-to": "home_menu" } : {})}
                {...(item.tone === "masters" ? { "data-masters-entry": true, "data-track": "masters_entry", "data-track-to": "home_menu" } : {})}
                {...(item.tone === "post" ? { "data-track": "post_start", "data-track-to": "home_menu" } : {})}
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
                  <span className={cn("flex items-center gap-1.5 text-base font-bold leading-tight", item.tone === "ai" && "text-ai", item.tone === "masters" && "theme-masters text-primary-ink", item.tone === "post" && "text-primary-ink")}>
                    <span className="truncate">{t(item.labelKey)}</span>
                    {item.fresh ? <NewDot feature={item.fresh} /> : null}
                  </span>
                  {/* kichik harf bilan — nima qiladi */}
                  <span className="mt-0.5 block text-sm leading-snug text-muted-foreground">{t(item.hintKey)}</span>
                </span>
                {badge ? (
                  <span className="flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full bg-destructive px-1.5 text-xs font-bold text-destructive-foreground">
                    {badge > 99 ? "99+" : badge}
                  </span>
                ) : null}
                <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
              </Link>
            </li>
          );
        })}
      </ul>
      {/* eng tagida, qizilda — rolni almashtirish (ish izlovchi ↔ ish beruvchi) */}
      <RoleSwitchRow
        className="mt-3"
        target={target}
        title={t(target === "employer" ? "easy.side.switch.to_employer" : "easy.side.switch.to_worker")}
        hint={t(target === "employer" ? "easy.side.switch.to_employer_hint" : "easy.side.switch.to_worker_hint")}
      />
    </nav>
  );
}
