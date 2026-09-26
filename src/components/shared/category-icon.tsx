import {
  Laptop, ShoppingCart, Megaphone, Palette, Calculator, Car, Truck, Bike, HardHat, Wrench, Zap, Droplet, Cog, CarFront,
  Utensils, Headset, Briefcase, GraduationCap, Stethoscope, Sparkles, Shield, Scissors, Factory, Wheat, MoreHorizontal, type LucideIcon,
} from "lucide-react";

/** Kategoriya ikonkasi (categories.icon → lucide) */
const ICONS: Record<string, LucideIcon> = {
  laptop: Laptop,
  "shopping-cart": ShoppingCart,
  megaphone: Megaphone,
  palette: Palette,
  calculator: Calculator,
  car: Car,
  truck: Truck,
  bike: Bike,
  "hard-hat": HardHat,
  wrench: Wrench,
  zap: Zap,
  droplet: Droplet,
  cog: Cog,
  "car-front": CarFront,
  utensils: Utensils,
  headset: Headset,
  briefcase: Briefcase,
  "graduation-cap": GraduationCap,
  stethoscope: Stethoscope,
  sparkles: Sparkles,
  shield: Shield,
  scissors: Scissors,
  "scissors-line-dashed": Scissors,
  factory: Factory,
  wheat: Wheat,
  "more-horizontal": MoreHorizontal,
};

export function CategoryIcon({ name, className }: { name: string | null | undefined; className?: string }) {
  const Icon = (name && ICONS[name]) || Briefcase;
  return <Icon className={className} aria-hidden />;
}
