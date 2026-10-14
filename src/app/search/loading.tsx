import { Skeleton } from "@/components/ui/skeleton";
import { LoadingShell } from "@/components/shared/app-frame";

/** Qidiruv qadami yoki natijalar serverdan kelguncha — darhol ko'rinadigan skelet (bosish "javobsiz" qolmaydi) */
function SearchLoadingContent() {
  return (
    <div className="container-narrow space-y-5 py-4 sm:py-8" data-step-loading aria-busy="true">
      <div className="space-y-3">
        <Skeleton className="h-12 w-32 rounded-xl" />
        <Skeleton className="h-8 w-3/4" />
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-14 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

/** Yuklanayotganda: oxirgi sahifaning yuqori paneli va menyusi joyida, kontent o'rnida skelet */
export default function SearchLoading() {
  return (
    <LoadingShell>
      <SearchLoadingContent />
    </LoadingShell>
  );
}
