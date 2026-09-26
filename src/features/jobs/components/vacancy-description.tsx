import { Fragment } from "react";
import { cn } from "@/lib/utils";
import { parseDescription, type Inline } from "../description";

function Inlines({ inlines }: { inlines: Inline[] }) {
  return <>{inlines.map((x, i) => (x.type === "bold" ? <strong key={i}>{x.value}</strong> : <Fragment key={i}>{x.value}</Fragment>))}</>;
}

/** Tavsif matnini xavfsiz render qiladi: paragraf, ro'yxat, sarlavha, qalin. HTML kiritilmaydi. */
export function VacancyDescription({ text, className }: { text: string | null | undefined; className?: string }) {
  const blocks = parseDescription(text);
  if (!blocks.length) return null;
  return (
    <div className={cn("space-y-3 text-[15px] leading-relaxed text-foreground/90", className)}>
      {blocks.map((b, i) => {
        if (b.type === "heading") {
          return (
            <h3 key={i} className="pt-1 text-base font-semibold text-foreground">
              <Inlines inlines={b.inlines} />
            </h3>
          );
        }
        if (b.type === "list") {
          const Tag = b.ordered ? "ol" : "ul";
          return (
            <Tag key={i} className={cn("space-y-1 pl-5", b.ordered ? "list-decimal" : "list-disc marker:text-primary")}>
              {b.items.map((item, j) => (
                <li key={j}>
                  <Inlines inlines={item} />
                </li>
              ))}
            </Tag>
          );
        }
        return (
          <p key={i}>
            {b.lines.map((line, j) => (
              <Fragment key={j}>
                {j > 0 ? <br /> : null}
                <Inlines inlines={line} />
              </Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}
