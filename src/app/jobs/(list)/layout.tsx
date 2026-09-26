import { Suspense, type ReactNode } from "react";
import { JobsHeader } from "@/features/jobs/components/jobs-header";
import { JobsHeaderSkeleton } from "@/features/jobs/components/skeletons";

/** Qidiruv maydoni + filtrlar layout'da: natijalar (page) yuklanayotganda ham joyida qoladi */
export default function JobsListLayout({ children }: { children: ReactNode }) {
  return (
    <div className="container-app py-4 sm:py-6">
      <Suspense fallback={<JobsHeaderSkeleton />}>
        <JobsHeader />
      </Suspense>
      {children}
    </div>
  );
}
