import { LoadingShell } from "@/components/shared/app-frame";
import { ChatSkeleton } from "@/components/shared/page-skeleton";

/** Bosilgan zahoti: menyu joyida, chat skeleti (sahifa oldindan yuklanadi) */
export default function Loading() {
  return (
    <LoadingShell>
      <ChatSkeleton />
    </LoadingShell>
  );
}
