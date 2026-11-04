import { LoadingShell } from "@/components/shared/app-frame";
import { PageSkeleton } from "@/components/shared/page-skeleton";

/**
 * Bosh sahifa ("Ishlar" tabi): bosilgan zahoti menyu + skelet. Faqat shu guruhda — ildizdagi loading.tsx boshqa sahifalarning
 * layout darajasidagi 404/yo'naltirish holat kodlarini buzardi.
 */
export default function Loading() {
  return (
    <LoadingShell>
      <PageSkeleton />
    </LoadingShell>
  );
}
