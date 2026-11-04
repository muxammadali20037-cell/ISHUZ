import { Skeleton } from "@/components/ui/skeleton";

/**
 * Har qanday sahifa yuklanayotganda (loading.tsx): sarlavha va kontent ritmidagi skelet — bosilgan zahoti ko'rinadi, menyu joyida
 * qoladi (LoadingShell). "SAT MASTER" namunasidagi PageSkeleton bilan bir xil tuzilma.
 */
export function PageSkeleton() {
  return (
    <div className="container-app py-6 lg:py-8" aria-busy="true">
      <Skeleton className="h-8 w-64 max-w-full" />
      <Skeleton className="mt-3 h-4 w-96 max-w-full" />
      <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-lg" />
        ))}
      </div>
      <Skeleton className="mt-6 h-64 rounded-lg" />
    </div>
  );
}

/** Menyusiz sahifalar (kirish, birinchi ochilish, "Dunyongizni yarating"): faqat markazdagi yengil skelet */
export function BareSkeleton() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 pt-[calc(var(--safe-top)+1.5rem)]" aria-busy="true">
      <Skeleton className="mx-auto h-2 w-40 rounded-full" />
      <Skeleton className="mx-auto mt-8 h-8 w-72 max-w-full" />
      <Skeleton className="mx-auto mt-3 h-4 w-80 max-w-full" />
      <div className="mt-8 grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-lg" />
        ))}
      </div>
    </div>
  );
}
