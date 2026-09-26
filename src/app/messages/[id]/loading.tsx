import { Skeleton } from "@/components/ui/skeleton";

export default function ConversationLoading() {
  return (
    <div className="flex flex-col" style={{ height: "calc(100dvh - 3.5rem)" }}>
      <div className="border-b border-border/70 bg-card">
        <div className="mx-auto flex w-full max-w-3xl items-center gap-3 px-3 py-2.5">
          <Skeleton className="size-8 rounded-xl" />
          <Skeleton className="size-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-56" />
          </div>
        </div>
      </div>
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-end gap-3 px-4 py-4">
        {[0, 1, 0, 0, 1, 0].map((mine, i) => (
          <div key={i} className={mine ? "flex justify-end" : "flex justify-start"}>
            <Skeleton className="h-10 rounded-2xl" style={{ width: `${40 + ((i * 17) % 35)}%` }} />
          </div>
        ))}
      </div>
      <div className="border-t border-border bg-card px-3 py-2">
        <div className="mx-auto flex w-full max-w-3xl items-center gap-2">
          <Skeleton className="size-11 rounded-full" />
          <Skeleton className="h-11 flex-1 rounded-2xl" />
          <Skeleton className="size-11 rounded-full" />
        </div>
      </div>
    </div>
  );
}
