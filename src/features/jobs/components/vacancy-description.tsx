import { Fragment } from "react";
import { CircleCheck } from "lucide-react";
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
    <div className={cn("space-y-3 text-md leading-relaxed text-foreground/90", className)}>
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
            <Tag key={i} className={cn("space-y-1 pl-5", b.ordered ? "list-decimal" : "list-disc marker:text-primary-ink")}>
              {b.items.map((item, j) => (
                <li key={j}>
                  <Inlines inlines={item} />
                </li>
              ))}
            </Tag>
          );
        }
        // "Izoh" bandlari (✅ bilan boshlanadigan qatorlar — features/post/notes.ts) — yashil belgili ro'yxat
        if (b.lines.length && b.lines.every((line) => line[0]?.type !== "bold" && (line[0]?.value ?? "").trimStart().startsWith("✅"))) {
          return (
            <ul key={i} className="space-y-1.5" data-notes-list>
              {b.lines.map((line, j) => (
                <li key={j} className="flex items-start gap-2">
                  <CircleCheck className="mt-0.5 size-5 shrink-0 text-success" aria-hidden />
                  <span className="min-w-0">
                    <Inlines inlines={[{ ...line[0]!, value: line[0]!.value.replace(/^\s*✅\s*/u, "") }, ...line.slice(1)]} />
                  </span>
                </li>
              ))}
            </ul>
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
