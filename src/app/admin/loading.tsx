import { Skeleton } from "@/components/ui/skeleton";
import { TableSkeleton } from "@/features/admin/components/data-table";

export default function AdminLoading() {
  return (
    <div>
      <Skeleton className="mb-5 h-8 w-56" />
      <div className="mb-4 flex gap-2">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-10 w-40" />
      </div>
      <TableSkeleton />
    </div>
  );
}
