import { Skeleton } from "@/components/ui/skeleton";
import { TableSkeleton } from "@/features/admin/components/data-table";

export default function AdminLoading() {
  return (
    <div>
      <Skeleton className="mb-5 h-8 w-56" />
      {/* telefonda qatorga tushadi — skelet 390 px'dan keng bo'lib, yuklanishda sahifa yonga siljimasin */}
      <div className="mb-4 flex flex-wrap gap-2">
        <Skeleton className="h-10 w-full max-w-72" />
        <Skeleton className="h-10 w-40" />
      </div>
      <TableSkeleton />
    </div>
  );
}
