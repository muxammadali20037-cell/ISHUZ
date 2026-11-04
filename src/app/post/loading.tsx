import { LoadingShell } from "@/components/shared/app-frame";
import { PageSkeleton } from "@/components/shared/page-skeleton";

/** E'lon berish ustasi menyusiz (hideNav) — yuklanishda ham menyu ko'rinmaydi */
export default function Loading() {
  return (
    <LoadingShell hideNav>
      <PageSkeleton />
    </LoadingShell>
  );
}
