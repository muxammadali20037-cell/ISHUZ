import { LoadingShell } from "@/components/shared/app-frame";
import { PageSkeleton } from "@/components/shared/page-skeleton";

/** Menyusiz oqim (hideNav): bosilgan zahoti skelet, menyu chaqnab ko'rinmaydi */
export default function Loading() {
  return (
    <LoadingShell hideNav>
      <PageSkeleton />
    </LoadingShell>
  );
}
