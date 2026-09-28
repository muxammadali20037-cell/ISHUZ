import {
  Laptop, ShoppingCart, Megaphone, Palette, Calculator, Car, Truck, Bike, HardHat, Wrench, Zap, Droplet, Cog, CarFront,
  Utensils, Headset, Briefcase, GraduationCap, Stethoscope, Sparkles, Shield, Scissors, Factory, Wheat, MoreHorizontal,
  HeartPulse, Smile, ScanLine, FlaskConical, Pill, School, Baby, Code, Server, ChefHat, Package, BedDouble, Scale, UserCog, Landmark, DraftingCompass,
  type LucideIcon,
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
  "heart-pulse": HeartPulse,
  smile: Smile,
  scan: ScanLine,
  "flask-conical": FlaskConical,
  pill: Pill,
  school: School,
  baby: Baby,
  code: Code,
  server: Server,
  "chef-hat": ChefHat,
  package: Package,
  "bed-double": BedDouble,
  scale: Scale,
  "user-cog": UserCog,
  landmark: Landmark,
  "drafting-compass": DraftingCompass,
};

export function CategoryIcon({ name, className }: { name: string | null | undefined; className?: string }) {
  const Icon = (name && ICONS[name]) || Briefcase;
  return <Icon className={className} aria-hidden />;
}
