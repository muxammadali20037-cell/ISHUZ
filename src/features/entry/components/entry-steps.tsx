/** Sozlash qadamlari ko'rsatkichi (05 → 06): "1/2-qadam" va ingichka chiziq */
export function EntrySteps({ current, total, label }: { current: number; total: number; label: string }) {
  return (
    <div className="flex items-center gap-3 px-3" data-entry-steps>
      <span className="text-sm font-semibold text-muted-foreground">{label}</span>
      <span className="flex gap-1" aria-hidden>
        {Array.from({ length: total }, (_, i) => (
          <span key={i} className={i < current ? "h-1.5 w-6 rounded-full bg-primary" : "h-1.5 w-6 rounded-full bg-border"} />
        ))}
      </span>
    </div>
  );
}
