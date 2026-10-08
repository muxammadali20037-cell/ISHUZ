import { Sparkles } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import type { Json } from "@/types/database.types";

type Review = { checked_at?: string; rules?: string[]; ai?: { consistent: boolean | null; mismatches: string[]; document_summary: string | null; extracted_name: string | null; extracted_tin: string | null } | null; ai_error?: string | null };

/** Tasdiqlash so'rovi bo'yicha yordamchi eslatmalar (qoidalar + AI). Qaror — adminniki. */
export async function VerificationAiNotes({ review }: { review: Json | null }) {
  const { t } = await getT();
  const r = (review ?? null) as Review | null;
  if (!r) return <p className="text-xs text-muted-foreground">{t("admin.verify_ai.not_checked")}</p>;
  return (
    <div className="space-y-1 text-xs">
      <p className="flex items-center gap-1 font-semibold">
        <Sparkles className="size-3.5 text-primary" aria-hidden /> {t("admin.verify_ai.title")}
      </p>
      {r.rules?.length ? (
        <ul className="list-disc pl-4 text-warning">
          {r.rules.map((n) => (
            <li key={n}>{t(`admin.verify_ai.rules.${n}`)}</li>
          ))}
        </ul>
      ) : null}
      {r.ai ? (
        <>
          <p className={r.ai.consistent === false ? "text-destructive" : r.ai.consistent ? "text-success" : "text-muted-foreground"}>
            {t(r.ai.consistent === false ? "admin.verify_ai.inconsistent" : r.ai.consistent ? "admin.verify_ai.consistent" : "admin.verify_ai.unclear")}
          </p>
          {r.ai.mismatches.length ? (
            <ul className="list-disc pl-4">
              {r.ai.mismatches.map((m, i) => (
                <li key={i}>{m}</li>
              ))}
            </ul>
          ) : null}
          {r.ai.document_summary ? <p className="text-muted-foreground">{r.ai.document_summary}</p> : null}
          {r.ai.extracted_name || r.ai.extracted_tin ? (
            <p className="text-muted-foreground">
              {t("admin.verify_ai.extracted")}: {[r.ai.extracted_name, r.ai.extracted_tin].filter(Boolean).join(" · ")}
            </p>
          ) : null}
        </>
      ) : r.ai_error ? (
        <p className="text-muted-foreground">{t("admin.verify_ai.ai_unavailable")}</p>
      ) : null}
      <p className="text-muted-foreground">{t("admin.verify_ai.disclaimer")}</p>
    </div>
  );
}
