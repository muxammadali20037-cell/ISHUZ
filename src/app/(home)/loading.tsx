import { LoadingShell } from "@/components/shared/app-frame";
import { ChatSkeleton } from "@/components/shared/page-skeleton";

/**
 * Bosh sahifa — chat: bosilgan zahoti menyu + chat skeleti. Faqat shu guruhda — ildizdagi loading.tsx boshqa sahifalarning
 * layout darajasidagi 404/yo'naltirish holat kodlarini buzardi.
 */
export default function Loading() {
  return (
    <LoadingShell>
      <ChatSkeleton />
    </LoadingShell>
  );
}
