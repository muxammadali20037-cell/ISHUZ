import { NextResponse, type NextRequest } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { publicEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Telegram xabaridagi kuzatiladigan havola: ochilish alohida o'lchanadi (yuborilish "o'qildi" degani emas),
 * so'ng ilovadagi sahifaga yo'naltiriladi. Token taxmin qilib bo'lmaydigan UUID; manzil faqat ichki yo'l.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const all = req.nextUrl.searchParams.get("all") === "1";
  let target = "/cabinet/matches";
  if (UUID.test(token)) {
    const db = createSupabaseClient<Database>(publicEnv.NEXT_PUBLIC_SUPABASE_URL, publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    const { data } = await db.rpc("notification_open", { p_token: token });
    if (!all && typeof data === "string" && data.startsWith("/") && !data.startsWith("//")) target = data;
    else if (all && typeof data === "string" && data.includes("vacancy=")) target = data;
  }
  return NextResponse.redirect(new URL(target, req.nextUrl.origin), 302);
}
