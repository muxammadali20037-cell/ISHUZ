import { createElement } from "react";
import {
  Armchair,
  BrickWall,
  Droplets,
  Flame,
  Hammer,
  KeyRound,
  LayoutGrid,
  PaintRoller,
  Snowflake,
  Truck,
  WashingMachine,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

/** master_categories.icon → lucide belgisi (ma'lumotnomada nom saqlanadi; nomi noma'lum bo'lsa — kalit) */
const ICONS: Record<string, LucideIcon> = {
  snowflake: Snowflake,
  droplets: Droplets,
  zap: Zap,
  washing: WashingMachine,
  hammer: Hammer,
  paint: PaintRoller,
  brick: BrickWall,
  flame: Flame,
  key: KeyRound,
  truck: Truck,
  armchair: Armchair,
  grid: LayoutGrid,
  wrench: Wrench,
};

export function CategoryIcon({
  icon,
  className,
}: {
  icon: string;
  className?: string;
}) {
  // belgi jadvaldan olinadi (har chizishda yangi komponent yaratilmaydi)
  return createElement(ICONS[icon] ?? Wrench, {
    className: cn("size-6", className),
    "aria-hidden": true,
  });
}
