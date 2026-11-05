/** Bosh sahifa bo'limi sarlavhasi: h2 + izoh + (ixtiyoriy) o'ngdagi havola */
export function SectionHead({ id, title, subtitle, action }: { id: string; title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-x-4 gap-y-1 sm:mb-6">
      <div className="min-w-0">
        <h2 id={id} className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {title}
        </h2>
        {subtitle ? <p className="mt-1.5 text-base text-muted-foreground">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}
