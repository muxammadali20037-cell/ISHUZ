import { BRAND } from "@/config/brand";

/** Logo matni: "Ish topdim" — ikkinchi qism asosiy rangda */
export function BrandWordmark() {
  return (
    <>
      {BRAND.wordmark[0]} <span className="text-primary">{BRAND.wordmark[1]}</span>
    </>
  );
}
