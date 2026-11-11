import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getT } from "@/lib/i18n/server";
import { allowRate } from "@/lib/rate-limit";
import { readJsonBody, rejectUnsafeRequest } from "@/lib/security/guard";
import { clientIp, ipBucket, subjectHash } from "@/lib/security/request";
import { getSession } from "@/features/auth/session";
import { getMode } from "@/features/mode/server";
import { runAssistantOnServer } from "@/features/assistant/server";
import type { AssistantEvent } from "@/features/assistant/types";

// model javobi oqim bilan keladi: 1–3 chaqiruv, umumiy chegara 30 s (dvigatelda) — zaxira bilan
export const maxDuration = 60;

const body = z.object({
  messages: z.array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().max(4000) })).min(1).max(40),
  /** rejim tanlanmagan mehmon uchun: kim sifatida gaplashyapti (rejim tanlangan bo'lsa — e'tiborga olinmaydi) */
  role: z.enum(["seeker", "employer"]).optional(),
});

/**
 * AI yordamchi suhbati. Javob — NDJSON oqimi (har qator bitta hodisa: status, text, results, suggestions, done, error).
 * Himoya: faqat o'z saytimizdan va faqat JSON (CSRF), bloklangan foydalanuvchi — yo'q, soatlik limit (kirgan — 80,
 * mehmon IP bo'yicha — 150), kunlik AI byudjeti (dvigatelda). Suhbat matni serverda saqlanmaydi.
 */
export async function POST(request: NextRequest) {
  const unsafe = rejectUnsafeRequest(request);
  if (unsafe) return unsafe;
  const parsed = body.safeParse(await readJsonBody(request, 64 * 1024));
  if (!parsed.success) return NextResponse.json({ error: "validation" }, { status: 400 });

  const session = await getSession();
  if (session?.profile.is_blocked) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const key = session ? `assistant:${session.userId}` : `assistant_ip:${subjectHash("ip", ipBucket(clientIp(request.headers)))}`;
  // mehmon limiti IP bo'yicha: mobil operatorlarda ko'p odam bitta IP ortida (CGNAT) — shuning uchun kengroq; xarajatni
  // kunlik AI byudjeti cheklaydi (tugasa — lug'at javobi), bu limit faqat botlarga qarshi
  if (!(await allowRate(key, session ? 80 : 150, 3600))) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  const [mode, { locale }] = await Promise.all([getMode(), getT()]);
  const role = mode ? (mode === "employer" ? "employer" : "seeker") : (parsed.data.role ?? "seeker");

  const encoder = new TextEncoder();
  const abort = new AbortController();
  request.signal.addEventListener("abort", () => abort.abort(), { once: true });
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const emit = (event: AssistantEvent) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch {
          closed = true; // brauzer ulanishni uzgan
        }
      };
      void runAssistantOnServer({ messages: parsed.data.messages, role, siteLocale: locale, session, emit, signal: abort.signal })
        .catch((e) => {
          console.error(JSON.stringify({ assistant_error: e instanceof Error ? e.message.slice(0, 200) : "error" }));
          emit({ type: "error", code: "unavailable" });
        })
        .finally(() => {
          if (closed) return;
          closed = true;
          try {
            controller.close();
          } catch {
            // allaqachon yopilgan
          }
        });
    },
    cancel() {
      abort.abort();
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store, no-transform", "X-Accel-Buffering": "no", "X-Robots-Tag": "noindex" },
  });
}
