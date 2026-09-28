import { NextResponse } from "next/server";
import { getSession } from "@/features/auth/session";
import { getLocale } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { buildCvData, cvFileName } from "@/features/cv/data";
import { renderCvPdf } from "@/features/cv/pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** O'z CV'sini PDF qilib yuklab olish (faqat egasi; RLS orqali o'qiladi, telefon bilan) */
export async function GET() {
  const session = await getSession();
  if (!session?.workerId) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const [supabase, locale] = await Promise.all([createClient(), getLocale()]);
  const data = await buildCvData(supabase, session.workerId, locale, { includePhone: true });
  if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const pdf = await renderCvPdf(data);
  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${cvFileName(data.name)}"`,
      "cache-control": "private, no-store",
    },
  });
}
