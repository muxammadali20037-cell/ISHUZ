import Link from "next/link";
import { BellRing, ChevronRight, Crown } from "lucide-react";

/** Bosh sahifadagi ko'zga tashlanadigan PRO karta → /ai-alerts */
export function AiAlertsCard({ title, description }: { title: string; description: string }) {
  return (
    <Link
      href="/ai-alerts"
      className="group relative flex items-center gap-4 overflow-hidden rounded-3xl bg-gradient-to-br from-violet-600 via-primary to-sky-500 p-5 text-white shadow-lg transition-transform active:scale-[0.99]"
    >
      <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-white/20">
        <BellRing className="size-7 group-hover:animate-pulse" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-lg font-extrabold leading-tight">
          {title} <Crown className="size-4 text-amber-300" />
        </span>
        <span className="mt-1 block text-sm text-white/90">{description}</span>
      </span>
      <ChevronRight className="size-6 shrink-0 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}
