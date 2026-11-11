import { BRAND } from "@/config/brand";

/** Logo matni: "Ish topdim" — ikkinchi qism asosiy rangda */
export function BrandWordmark({ onDark = false }: { onDark?: boolean }) {
  return (
    <>
      {BRAND.wordmark[0]} <span className={onDark ? "text-sidebar-accent" : "text-primary-ink"}>{BRAND.wordmark[1]}</span>
    </>
  );
}
