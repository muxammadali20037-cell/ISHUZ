import { LoadingShell } from "@/components/shared/app-frame";
import { PageSkeleton } from "@/components/shared/page-skeleton";

/** Bosilgan zahoti: menyu joyida, kontent o'rnida skelet (sahifa oldindan yuklanadi — "SAT MASTER" kabi tezlik) */
export default function Loading() {
  return (
    <LoadingShell>
      <PageSkeleton />
    </LoadingShell>
  );
}
