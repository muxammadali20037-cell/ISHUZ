/** Bosh sahifa bo'limi sarlavhasi: h2 + izoh + (ixtiyoriy) o'ngdagi havola. `compact` — rol bosh sahifalaridagi ixcham o'lcham */
export function SectionHead({ id, title, subtitle, action, compact = false }: { id: string; title: string; subtitle?: string; action?: React.ReactNode; compact?: boolean }) {
  return (
    <div className={compact ? "mb-3 flex flex-wrap items-end justify-between gap-x-4 gap-y-1" : "mb-5 flex flex-wrap items-end justify-between gap-x-4 gap-y-1 sm:mb-6"}>
      <div className="min-w-0">
        <h2 id={id} className={compact ? "text-lg font-semibold leading-tight" : "text-2xl font-semibold tracking-tight sm:text-3xl"}>
          {title}
        </h2>
        {subtitle ? <p className={compact ? "mt-0.5 text-sm text-muted-foreground" : "mt-1.5 text-base text-muted-foreground"}>{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}
